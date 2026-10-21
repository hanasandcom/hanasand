import config from '#constants'
import { AsyncLocalStorage } from 'node:async_hooks'
import pg from 'pg'
import { pool, eventPool, priorityEventPool, readPool, directPool, schemaWork, schemaLockTimeout } from './runtimePools.ts'
import { activePool, connectDatabase, withReadDatabase } from './runtimePoolAccess.ts'
import { normalizeIdentitySchemaQuery } from './identitySchemaQuery.ts'
import type { SQLParamType } from './runtimePools.ts'

type PgError = Error & { code?: string }
const queryRetryDeadline = new AsyncLocalStorage<number>()

export function withDatabaseRetryBudget<T>(budgetMs: number, work: () => Promise<T>) {
    return queryRetryDeadline.run(Date.now() + Math.max(0, budgetMs), work)
}

export async function isDatabaseLowLoad(maxActiveQueries = 8) {
    const pools = [...new Set([pool, eventPool, priorityEventPool, readPool, directPool])]
    if (pools.some(connectionPool => connectionPool.waitingCount > 0) || pool.idleCount === 0) return false
    try {
        const { rows } = await queryOnce(`SELECT
            count(*) FILTER (WHERE state = 'active' AND pid <> pg_backend_pid())::int AS active_queries,
            count(*) FILTER (WHERE wait_event_type = 'Lock' AND pid <> pg_backend_pid())::int AS lock_waiters
            FROM pg_stat_activity WHERE datname = current_database()`)
        return Number(rows[0]?.active_queries || 0) <= maxActiveQueries && Number(rows[0]?.lock_waiters || 0) === 0
    } catch {
        // Background scans must wait when the database cannot confirm it is quiet.
        return false
    }
}

export default async function run(query: string, params?: SQLParamType, name?: string) {
    // Authentication must fail promptly; replaying an ambiguous write can duplicate it.
    if ((process.env.AUTH_SERVICE_ONLY === '1' || process.env.API_HTTP_ONLY === '1')) return queryOnce(query, params, name)
    while (true) {
        try {
            return await queryOnce(query, params, name)
        } catch (error) {
            if (!isTransientDatabaseError(error)) {
                throw error
            }

            const deadline = queryRetryDeadline.getStore()
            if (deadline !== undefined && deadline - Date.now() <= config.CACHE_TTL_HOT + 3000) throw error

            console.log(`Pool currently unavailable, retrying in ${config.CACHE_TTL_HOT / 1000}s...`)
            console.log(error)
            await sleep(config.CACHE_TTL_HOT)
        }
    }
}

;

(run as typeof run & { primaryDatabaseRunner?: boolean }).primaryDatabaseRunner = true
;

(run as typeof run & { withReadDatabase?: typeof withReadDatabase }).withReadDatabase = withReadDatabase

export async function queryOnce(query: string, params?: SQLParamType, name?: string) {
    const normalizedQuery = await normalizeIdentitySchemaQuery(query)
    if (normalizedQuery === null) {
        return { rows: [], rowCount: 0, command: 'IDENTITY_SCHEMA_OWNED_BY_IDENTITY', oid: 0, fields: [] } as pg.QueryResult
    }
    query = normalizedQuery
    const client = await connectDatabase(activePool()).catch(error => {
        // No query has been submitted yet: one retry can survive a brief pool
        // shortage without replaying writes or extending authentication retries.
        if (process.env.API_HTTP_ONLY === '1' && process.env.AUTH_SERVICE_ONLY !== '1'
            && (isTransientDatabaseError(error) || error?.message === 'timeout exceeded when trying to connect')) {
            return connectDatabase(activePool())
        }
        throw error
    })
    let failure: Error | undefined
    let expired = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let onlineIndex = /^\s*(?:CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+INDEX)\s+CONCURRENTLY\b/i.test(query)
    const legacyEventKeyCleanup = /^\s*(?:DROP\s+INDEX\s+CONCURRENTLY\s+IF\s+EXISTS\s+idx_events_log_key|ALTER\s+TABLE\s+events\s+DROP\s+COLUMN\s+IF\s+EXISTS\s+log_key)\b/i.test(query)
    const columnAdd = /^\s*ALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/i.test(query)
    const largeServiceLogDrop = /^\s*DROP\s+TABLE\s+IF\s+EXISTS\s+service_logs\b/i.test(query)
    const trafficHistorySchema = /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+traffic_history_state\b/i.test(query)
    try {
        if (schemaWork.getStore()) {
            const createIndex = !onlineIndex && !name && !params?.length
                ? query.match(/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([^\s;]+)\s+ON\b/i)
                : null
            if (createIndex) {
                const existing = (await client.query(
                    'SELECT indisvalid,indisready FROM pg_index WHERE indexrelid=to_regclass($1)',
                    [createIndex[1]],
                )).rows[0]
                if (existing) {
                    if (!existing.indisvalid || !existing.indisready) {
                        throw new Error(`Existing schema index is not ready: ${createIndex[1]}`)
                    }
                    return { command: 'CREATE', rowCount: null, oid: 0, rows: [], fields: [] } as pg.QueryResult
                }
                // A missing index is built online so schema setup does not block
                // normal reads or writes on the indexed table.
                query = query.replace(/^(\s*CREATE\s+(?:UNIQUE\s+)?INDEX)\s+IF\s+NOT\s+EXISTS\b/i, '$1 CONCURRENTLY IF NOT EXISTS')
                onlineIndex = true
            }
            await client.query(`SET lock_timeout = '${schemaLockTimeout}'; SET statement_timeout = '5s'`)
            // Cancelling an online index build leaves an invalid index behind.
            // It allows normal reads/writes, so retain only its lock-wait limit.
            if (onlineIndex) {
                await client.query('SET lock_timeout = \'30s\'; SET statement_timeout = 0')
            }
            // Readers may still be finishing queries against the legacy key. Both
            // operations are bounded and do not rewrite the events heap.
            if (legacyEventKeyCleanup) await client.query('SET lock_timeout = \'5min\'; SET statement_timeout = \'6min\'')
            if (columnAdd) await client.query('SET lock_timeout = \'5s\'; SET statement_timeout = \'10s\'')
            // Traffic history replaces a view that live dashboard queries can hold
            // open. Bound the wait, but let this small schema batch complete.
            if (trafficHistorySchema) await client.query('SET lock_timeout = \'30s\'; SET statement_timeout = \'60s\'')
            // Dropping the duplicated 48 GB heap and its indexes can take
            // longer than a normal schema statement while unlinking files.
            // Give the table lock a bounded wait and let the large file removal finish.
            if (largeServiceLogDrop) await client.query('SET lock_timeout = \'30s\'; SET statement_timeout = \'60s\'')
        }
        const pending = name
            ? client.query({ name, text: query, values: params ?? [] })
            : client.query(query, params ?? [])
        if (!schemaWork.getStore() || onlineIndex || largeServiceLogDrop || trafficHistorySchema || legacyEventKeyCleanup) return await pending
        // A simple-protocol SQL batch is one implicit transaction. PostgreSQL's
        // statement_timeout applies separately to each statement in that batch.
        return await Promise.race([pending, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                expired = true
                const error = Object.assign(new Error('Schema SQL batch exceeded 8 seconds'), { code: '57014' })
                client.release(error)
                reject(error)
            }, 8000)
        })])
    } catch (error) {
        failure = error as Error
        if (schemaWork.getStore() && ['55P03', '57014'].includes((error as PgError)?.code || '')) {
            console.warn('Schema statement deferred by PostgreSQL timeout.', {
                code: (error as PgError).code,
                message: (error as Error).message,
                query: query.replace(/\s+/g, ' ').slice(0, 240)
            })
        }
        throw error
    } finally {
        clearTimeout(timer)
        if (schemaWork.getStore() && !failure) {
            await client.query('RESET lock_timeout; RESET statement_timeout').catch(error => { failure = error })
        }
        if (!expired) client.release(failure)
    }
}

export function isTransientDatabaseError(error: unknown) {
    const err = error as PgError
    const message = err?.message?.toLowerCase() || ''
    const retryableCodes = new Set([
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EAI_AGAIN',
        '08000',
        '08001',
        '08003',
        '08006',
        '53300',
        '57P03',
    ])

    return Boolean(err?.code && retryableCodes.has(err.code))
        || message.includes('connection terminated')
        || message.includes('connection timeout')
        || message.includes('timeout exceeded when trying to connect')
        || message.includes('timeout expired')
}

function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms))
}
