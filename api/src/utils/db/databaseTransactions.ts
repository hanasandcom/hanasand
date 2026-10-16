import type pg from 'pg'
import { DB_POOL_HOST, directPool, schemaWork, schemaLockTimeout, identityPool, type SQLParamType } from './runtimePools.ts'
import { activePool, connectDatabase } from './runtimePoolAccess.ts'
import { queryOnce } from './databaseQuery.ts'

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
