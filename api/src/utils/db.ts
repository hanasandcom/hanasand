import pg from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'
import config from '#constants'
import { identityDataTables } from './db/identityDataTables.ts'

type SQLParamType = (string | number | null | boolean | string[] | Date)[]
type PgError = Error & {
    code?: string
}

const {
    DB,
    DB_USER,
    DB_HOST,
    DB_POOL_HOST,
    DB_POOL_PORT,
    DB_PASSWORD,
    DB_PORT,
    DB_MAX_CONN,
    DB_IDLE_TIMEOUT_MS,
    DB_TIMEOUT_MS
} = config
const { Pool } = pg
const schemaWork = new AsyncLocalStorage<boolean>()
let identityDataDetachedState: Promise<boolean> | undefined
const identityDataTableNames = new Set<string>(identityDataTables)
const identityDataTablePattern = identityDataTables.join('|')

// A queued schema lock also blocks later reads, including authentication.
// Fail fast so a busy migration cannot queue site requests behind it.
const schemaLockTimeout = '100ms'
export function withSchemaLockTimeout<T>(work: () => Promise<T>): Promise<T> {
    return schemaWork.run(true, work)
}

const eventWork = new AsyncLocalStorage<boolean>()
const priorityEventWork = new AsyncLocalStorage<boolean>()
const readWork = new AsyncLocalStorage<boolean>()
const maxConnections = Number(DB_MAX_CONN) || (DB_POOL_HOST ? 1000 : 20)
// Bound the number of requests waiting inside node-postgres. Without this,
// bursts can turn into an unbounded in-process queue while the database is slow.
const maxWaitingConnections = Math.max(8, Math.min(64, maxConnections * 2))
// Schema setup and session-scoped advisory locks bypass transaction pooling.
// Reserve those clients inside the configured total instead of adding a second budget.
const directConnections = DB_POOL_HOST ? Math.min(8, maxConnections) : 0
const dedicatedLogProcessor = process.env.LOG_PROCESSOR_ONLY === '1'
const httpOnlyApi = process.env.API_HTTP_ONLY === '1' && process.env.AUTH_SERVICE_ONLY !== '1'
const primaryReserve = dedicatedLogProcessor ? Math.min(4, Math.max(0, maxConnections - directConnections)) : 0
// Keep a small pool available for new logs while the durable history pass is busy.
const priorityEventConnections = dedicatedLogProcessor
    ? Math.min(4, Math.max(0, maxConnections - directConnections - primaryReserve))
    : 0
// The dedicated log worker does not serve API reads; reserve its pool budget
// for independent event writes instead of creating an unused read pool.
const readConnections = dedicatedLogProcessor
    ? 0
    : process.env.AUTH_SERVICE_ONLY !== '1' && maxConnections >= 16
        ? Math.min(10, Math.max(2, Math.floor(maxConnections / 10))) : 0
// Reserve worker capacity without increasing its total connection budget.
// Event holds cursor and batch locks while committing evidence on another client.
const eventConnections = process.env.LOG_PROCESSOR_ONLY === '1'
    ? Math.min(36, Math.max(0, maxConnections - directConnections - readConnections - priorityEventConnections - primaryReserve))
    : process.env.API_HTTP_ONLY !== '1' && process.env.AUTH_SERVICE_ONLY !== '1'
        && maxConnections >= 12 ? 8 : 0
const primaryConnections = Math.max(0, maxConnections - eventConnections - priorityEventConnections - readConnections - directConnections)
const warmupBudget = Math.max(0, Math.min(maxConnections, Math.floor(Number(process.env.DB_POOL_WARMUP_CONN) || 0)))
const httpReadWarmup = httpOnlyApi ? Math.min(readConnections, warmupBudget) : 0
const primaryWarmup = Math.min(primaryConnections, Math.max(0, warmupBudget - httpReadWarmup))
const priorityEventWarmup = Math.min(priorityEventConnections, Math.max(0, warmupBudget - primaryWarmup))
const eventWarmup = Math.min(eventConnections, Math.max(0, warmupBudget - primaryWarmup - priorityEventWarmup))
const readWarmup = Math.max(httpReadWarmup, Math.min(readConnections, Math.max(0, warmupBudget - primaryWarmup - priorityEventWarmup - eventWarmup)))
const directWarmup = Math.min(directConnections, Math.max(0, warmupBudget - primaryWarmup - priorityEventWarmup - eventWarmup - readWarmup))
const configuredIdleTimeout = Number(DB_IDLE_TIMEOUT_MS) || (
    process.env.AUTH_SERVICE_ONLY === '1' ? 5000 : 120_000
)
const poolOptions = {
    user: DB_USER || 'hanasand',
    host: DB_POOL_HOST || DB_HOST,
    database: DB || 'hanasand',
    password: DB_PASSWORD,
    port: Number(DB_POOL_PORT) || Number(DB_PORT) || 5432,
    application_name: process.env.AUTH_SERVICE_ONLY === '1'
        ? 'hanasand-auth'
        : httpOnlyApi ? 'hanasand-api-http' : 'hanasand-api',
    max: primaryConnections,
    // Keep warmed client sessions available so bursts reuse SCRAM-authenticated
    // connections instead of paying the handshake cost on request paths.
    min: primaryWarmup,
    idleTimeoutMillis: httpOnlyApi
        ? Math.min(Math.max(configuredIdleTimeout, 1), 15_000)
        : configuredIdleTimeout,
    // Rotate sessions even under steady traffic so old HAProxy workers can drain.
    maxLifetimeSeconds: httpOnlyApi ? 45 : undefined,
    connectionTimeoutMillis: Number(DB_TIMEOUT_MS) || 3000,
    statement_timeout: (process.env.AUTH_SERVICE_ONLY === '1' || process.env.API_HTTP_ONLY === '1') ? 5000 : undefined,
    keepAlive: true
}
const pool = new Pool(poolOptions)
const eventPool = eventConnections ? new Pool({ ...poolOptions, max: eventConnections, min: eventWarmup }) : pool
const priorityEventPool = priorityEventConnections ? new Pool({ ...poolOptions, application_name: 'hanasand-log-priority', max: priorityEventConnections, min: priorityEventWarmup }) : pool
const readPool = readConnections ? new Pool({ ...poolOptions, application_name: `${poolOptions.application_name}-read`, max: readConnections, min: readWarmup }) : pool
// Schema startup uses session-scoped SET/RESET and CREATE INDEX CONCURRENTLY.
// Keep that small, infrequent path on PostgreSQL directly when traffic uses PgBouncer.
const directPool = DB_POOL_HOST ? new Pool({ ...poolOptions, host: DB_HOST, port: Number(DB_PORT) || 5432, max: directConnections, min: directWarmup }) : pool
// SSH key data belongs to Identity. Query its PostgreSQL directly instead of
// sending interactive profile reads through the application DB's FDW views.
const identityHost = process.env.HANASAND_IDENTITY_FDW_HOST
const identityPool = identityHost ? new Pool({
    ...poolOptions,
    host: identityHost,
    port: Number(process.env.HANASAND_IDENTITY_FDW_PORT) || 5432,
    database: process.env.IDENTITY_DB_NAME || 'identity',
    application_name: 'hanasand-api-identity-data',
    max: Math.max(1, Math.min(4, Number(process.env.IDENTITY_DB_MAX_CONN) || 4)),
    min: 1,
    statement_timeout: 5000,
}) : null

export async function warmDatabasePools() {
    const targets = new Map([[pool, primaryWarmup], [eventPool, eventWarmup], [priorityEventPool, priorityEventWarmup], [readPool, readWarmup], [directPool, directWarmup]])
    await Promise.all([...targets].map(async ([connectionPool, minimum]) => {
        const missing = Math.max(0, minimum - connectionPool.totalCount)
        await Promise.all(Array.from({ length: missing }, async () => {
            const client = await connectionPool.connect()
            client.release()
        }))
    }))
    if (identityPool && process.env.AUTH_SERVICE_ONLY !== '1') {
        const client = await identityPool.connect()
        client.release()
    }
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

export function withEventDatabase<T>(work: () => Promise<T>): Promise<T> {
    return eventWork.run(true, work)
}

export function withPriorityEventDatabase<T>(work: () => Promise<T>): Promise<T> {
    return priorityEventWork.run(true, work)
}

export function withReadDatabase<T>(work: () => Promise<T>): Promise<T> {
    return readWork.run(true, work)
}

function activePool() {
    if (schemaWork.getStore()) return directPool
    if (readWork.getStore()) {
        // Keep ten read connections in their own pool. When that pool is fully
        // occupied, let reads borrow idle or not-yet-open primary capacity while
        // preserving at least 20 primary slots for ordinary API work.
        const primaryReserve = Math.min(20, primaryConnections)
        const readPoolAtCapacity = readPool !== pool
            && readPool.totalCount >= readConnections
            && readPool.idleCount === 0
        const primaryHasBorrowableCapacity = pool.idleCount > primaryReserve
            || pool.totalCount < primaryConnections - primaryReserve
        if (readPoolAtCapacity && primaryHasBorrowableCapacity) return pool
        return readPool
    }
    if (priorityEventWork.getStore()) return priorityEventPool
    return eventWork.getStore() ? eventPool : pool
}

function connectDatabase(connectionPool: pg.Pool) {
    if (connectionPool.waitingCount >= maxWaitingConnections) {
        throw Object.assign(new Error('Database is temporarily busy. Try again shortly.'), { statusCode: 503, code: 'DB_QUEUE_FULL' })
    }
    return connectionPool.connect()
}

// Checked-out clients can emit transport errors between queries, outside the pool's idle handler.
for (const connectionPool of new Set([pool, eventPool, priorityEventPool, readPool, directPool, ...(identityPool ? [identityPool] : [])])) {
    connectionPool.on('connect', client => client.on('error', error => console.error('Database connection failed:', error.message)))
    connectionPool.on('error', error => console.error('Idle database connection failed:', error.message))
}

export async function closeDatabase() {
    await Promise.all([...new Set([pool, eventPool, priorityEventPool, readPool, directPool, ...(identityPool ? [identityPool] : [])])].map(connectionPool => connectionPool.end()))
}

export async function identityQueryOnce(query: string, params?: SQLParamType, name?: string) {
    if (!identityPool) {
        if (process.env.NODE_ENV === 'production') throw new Error('Identity PostgreSQL is not configured.')
        return queryOnce(query, params, name)
    }
    return name
        ? identityPool.query({ name, text: query, values: params ?? [] })
        : identityPool.query(query, params ?? [])
}

export async function withIdentityAdvisoryLock<T>(key: string, work: () => Promise<T>) {
    if (!identityPool) {
        if (process.env.NODE_ENV === 'production') throw new Error('Identity PostgreSQL is not configured.')
        return withDatabaseAdvisoryLock(key, work)
    }
    const client = await identityPool.connect()
    try {
        await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [key])
        return await work()
    } finally {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key]).catch(() => {})
        client.release()
    }
}

export async function withIdentityTransaction<T>(work: (query: typeof identityQueryOnce) => Promise<T>) {
    if (!identityPool) {
        if (process.env.NODE_ENV === 'production') throw new Error('Identity PostgreSQL is not configured.')
        return withTransaction(work as (query: typeof queryOnce) => Promise<T>)
    }
    const client = await identityPool.connect()
    const query = ((sql: string, params?: SQLParamType, name?: string) => name
        ? client.query({ name, text: sql, values: params ?? [] })
        : client.query(sql, params ?? [])) as typeof identityQueryOnce
    try {
        await client.query('BEGIN')
        const result = await work(query)
        await client.query('COMMIT')
        return result
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
    } finally {
        client.release()
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

            console.log(`Pool currently unavailable, retrying in ${config.CACHE_TTL_HOT / 1000}s...`)
            console.log(error)
            await sleep(config.CACHE_TTL_HOT)
        }
    }
}

;(run as typeof run & { primaryDatabaseRunner?: boolean }).primaryDatabaseRunner = true
;(run as typeof run & { withReadDatabase?: typeof withReadDatabase }).withReadDatabase = withReadDatabase

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

export function markIdentityDataDetached() {
    identityDataDetachedState = Promise.resolve(true)
}

async function normalizeIdentitySchemaQuery(query: string) {
    const referencesIdentity = new RegExp(`\\bREFERENCES\\s+(?:public\\.)?(?:${identityDataTablePattern})\\s*\\(`, 'i').test(query)
    const identityDdl = isIdentityTableDdl(query)
    if (!referencesIdentity && !identityDdl) return query
    if (!await identityDataIsDetached()) return query

    if (identityDdl || /^\s*ALTER\s+TABLE\b[\s\S]*\bADD\s+CONSTRAINT\b[\s\S]*\bFOREIGN\s+KEY\b/i.test(query)) return null
    return query
        .replace(new RegExp(`\\s+REFERENCES\\s+(?:public\\.)?(?:${identityDataTablePattern})\\s*\\([^)]*\\)(?:\\s+ON\\s+DELETE\\s+(?:CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION))?(?:\\s+ON\\s+UPDATE\\s+(?:CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION))?`, 'gi'), '')
        .replace(new RegExp(`(?:CONSTRAINT\\s+[a-z0-9_]+\\s+)?FOREIGN\\s+KEY\\s*\\([^)]*\\)\\s*REFERENCES\\s+(?:public\\.)?(?:${identityDataTablePattern})\\s*\\([^)]*\\)(?:\\s+ON\\s+(?:DELETE|UPDATE)\\s+(?:CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION))*\\s*,?`, 'gi'), '')
}

function isIdentityTableDdl(query: string) {
    const table = query.match(/^\s*(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNLOGGED\s+)?(?:TABLE|VIEW|FOREIGN\s+TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?|ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?|DROP\s+(?:TABLE|VIEW)\s+(?:IF\s+EXISTS\s+)?)(?:public\.)?["']?([a-z0-9_]+)/i)
    if (table && identityDataTableNames.has(table[1].toLowerCase())) return true

    const index = query.match(/^\s*(?:CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?[a-z0-9_]+\s+ON\s+(?:public\.)?|ALTER\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:public\.)?)([a-z0-9_]+)/i)
    if (index && identityDataTableNames.has(index[1].toLowerCase())) return true
    if (/^\s*(?:ALTER|DROP)\s+INDEX\b/i.test(query) && /\b(?:idx_system_events|idx_admin_access_recovery|idx_organization_(?:watchlist|privacy|retention)|idx_(?:users|login_events|api_keys|api_key_scopes|certificates|user_certificates|host_ssh_keys|impersonation|passkey|password_reset|signup_verification|mail_accounts)[a-z0-9_]*)\b/i.test(query)) return true

    // The legacy audit and impersonation renames are wrapped in DO blocks.
    return /^\s*DO\b/i.test(query)
        && new RegExp(`\\b(?:ALTER|CREATE|DROP)\\s+(?:TABLE|INDEX)\\b[\\s\\S]*?\\b(?:${identityDataTablePattern})\\b`, 'i').test(query)
}

async function identityDataIsDetached() {
    return identityDataDetachedState ||= pool.query(`
        SELECT (to_regclass('public.identity_data_boundary') IS NOT NULL)
            AND EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.users') AND relkind = 'v') AS ready
    `).then(result => result.rows[0]?.ready === true)
}

export async function withDatabaseAdvisoryLock<T>(key: string, work: (query: (sql: string, params?: SQLParamType) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
    // A session advisory lock must keep using the same PostgreSQL backend until
    // it is unlocked. Transaction pooling can assign a different backend per query.
    const client = await connectDatabase(DB_POOL_HOST ? directPool : activePool())
    try {
        await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [key])
        const query = (sql: string, params?: SQLParamType) => client.query(sql, params ?? [])
        return await work(query)
    } finally {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key]).catch(() => {})
        client.release()
    }
}

export async function tryWithDatabaseAdvisoryLock<T>(key: string, work: () => Promise<T>): Promise<{ acquired: boolean, result?: T }> {
    // Hold the session lock on a direct connection so multiple API workers never
    // run a long estimate sweep at the same time, including through PgBouncer.
    const client = await connectDatabase(DB_POOL_HOST ? directPool : activePool())
    let acquired = false
    try {
        const result = await client.query('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked', [key])
        acquired = result.rows[0]?.locked === true
        if (!acquired) return { acquired: false }
        return { acquired: true, result: await work() }
    } finally {
        if (acquired) await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key]).catch(() => {})
        client.release()
    }
}

export async function withTransaction<T>(work: (query: typeof queryOnce) => Promise<T>, options: { timeoutMs?: number; statementTimeoutMs?: number } = {}) {
    const client = await connectDatabase(activePool())
    const schema = schemaWork.getStore()
    const transactionTimeoutMs = options.timeoutMs ?? 8000
    const statementTimeoutMs = options.statementTimeoutMs ?? 5000
    let expired = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutError = Object.assign(new Error(`Database transaction exceeded ${transactionTimeoutMs}ms`), { code: '57014' })
    const query = ((sql: string, params?: SQLParamType, name?: string) => {
        if (expired) return Promise.reject(timeoutError)
        return name
            ? client.query({ name, text: sql, values: params ?? [] })
            : client.query(sql, params ?? [])
    }) as typeof queryOnce
    const execute = async () => {
        await client.query('BEGIN')
        if (schema) await client.query(`SET LOCAL lock_timeout = '${schemaLockTimeout}'; SET LOCAL statement_timeout = '${statementTimeoutMs}ms'; SET LOCAL idle_in_transaction_session_timeout = '5s'`)
        const result = await work(query)
        if (expired) throw timeoutError
        await client.query('COMMIT')
        return result
    }
    try {
        if (!schema) return await execute()
        return await Promise.race([execute(), new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                expired = true
                // Closing the connection rolls back the whole transaction and
                // releases its locks, even if application code is awaiting I/O.
                client.release(timeoutError)
                reject(timeoutError)
            }, transactionTimeoutMs)
        })])
    } catch (error) {
        if (!expired) await client.query('ROLLBACK')
        throw error
    } finally {
        clearTimeout(timer)
        if (!expired) client.release()
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
