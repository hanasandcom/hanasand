import type pg from 'pg'
import { pool, eventPool, priorityEventPool, readPool, directPool, identityPool, maxWaitingConnections, schemaWork, eventWork, priorityEventWork, readWork, primaryWarmup, eventWarmup, priorityEventWarmup, readWarmup, directWarmup, readConnections, primaryConnections } from './runtimePools.ts'

export async function warmDatabasePools() {
    const warmupTargets: [pg.Pool, number][] = [
        [pool, primaryWarmup],
        [eventPool, eventWarmup],
        [priorityEventPool, priorityEventWarmup],
        [readPool, readWarmup],
        [directPool, directWarmup],
    ]
    const targets = new Map<pg.Pool, number>()
    for (const [connectionPool, minimum] of warmupTargets) {
        targets.set(connectionPool, Math.max(targets.get(connectionPool) ?? 0, minimum))
    }
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

export function withEventDatabase<T>(work: () => Promise<T>): Promise<T> {
    return eventWork.run(true, work)
}

export function withPriorityEventDatabase<T>(work: () => Promise<T>): Promise<T> {
    return priorityEventWork.run(true, work)
}

export function withReadDatabase<T>(work: () => Promise<T>): Promise<T> {
    return readWork.run(true, work)
}

export function activePool() {
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

export function connectDatabase(connectionPool: pg.Pool) {
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
