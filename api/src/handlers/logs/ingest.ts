import type { FastifyReply, FastifyRequest } from 'fastify'
import { isTransientDatabaseError, withTransaction } from '#db'
import { hasLogIngestToken } from '#utils/auth/logIngestToken.ts'
export { hasLogIngestToken } from '#utils/auth/logIngestToken.ts'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { recordLogBatch } from '#utils/logs/recordLog.ts'
import config from '#constants'

// Each batch holds a connection through up to 200 writes. Leave capacity for
// interactive requests; collectors retain unacknowledged batches for retry.
export const logIngestCapacity = Math.max(1, Math.min(2, Math.floor((Number(config.DB_MAX_CONN) || 20) / 4)))
let activeBatches = 0
const eventFields = new Set(['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])

function postgresSafeJson(value: unknown): unknown {
    if (typeof value === 'string') return value.replaceAll('\u0000', '\uFFFD')
    if (Array.isArray(value)) return value.map(postgresSafeJson)
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replaceAll('\u0000', '\uFFFD'), postgresSafeJson(item)]))
    }
    return value
}

export default async function ingestLog(req: FastifyRequest, res: FastifyReply) {
    if (!hasLogIngestToken(req) && !hasInternalToken(req)) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const body = req.body as Record<string, unknown> | undefined
    const entries = (Array.isArray(body?.events) ? body.events : [body]).map(postgresSafeJson) as unknown[]
    if (!entries.length || entries.length > 200) return res.status(400).send({ error: 'Send 1–200 events.' })
    for (const candidate of entries) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return res.status(400).send({ error: 'Invalid log event.' })
        const entry = candidate as Record<string, unknown>
        if (Object.keys(entry).some(key => !eventFields.has(key)) || typeof entry.service !== 'string' || typeof entry.message !== 'string'
            || !entry.service || entry.service.length > 256 || !entry.message || entry.message.length > 65536
            || (entry.host !== undefined && (typeof entry.host !== 'string' || entry.host.length > 256))
            || (entry.metadata !== undefined && (!entry.metadata || typeof entry.metadata !== 'object' || Array.isArray(entry.metadata)))
            || (entry.level && (typeof entry.level !== 'string' || !['debug', 'info', 'warn', 'error', 'fatal'].includes(entry.level)))
            || (entry.timestamp && (typeof entry.timestamp !== 'string' || !Number.isFinite(Date.parse(entry.timestamp))))
            || (entry.sourceEventId && (typeof entry.sourceEventId !== 'string' || entry.sourceEventId.length > 256))) {
            return res.status(400).send({ error: 'Invalid log event.' })
        }
    }
    if (activeBatches >= logIngestCapacity) {
        return res.header('Retry-After', '1').status(503).send({ code: 'LOG_INGEST_BUSY', error: 'Log ingestion is busy. Retry this batch shortly.' })
    }
    activeBatches++
    try {
        try {
            await withTransaction(async query => {
                await query('SET LOCAL lock_timeout=\'1ms\'')
                const acceptedEntries = entries as Parameters<typeof recordLogBatch>[0]
                await recordLogBatch(acceptedEntries.map(entry => ({ ...entry, level: entry.level || 'info' })), query)
            })
        } catch (error) {
            const code = (error as { code?: string })?.code
            if (isTransientDatabaseError(error) || code === '55P03' || code === '57014' || code === '40P01' || code === '40001' || code === 'DB_QUEUE_FULL') {
                return res.header('Retry-After', '1').status(503).send({ code: 'LOG_INGEST_BUSY', error: 'Log ingestion is busy. Retry this batch shortly.' })
            }
            throw error
        }
    } finally {
        activeBatches--
    }
    return res.status(201).send({ ok: true, accepted: entries.length })
}
