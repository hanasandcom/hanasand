import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { matchApiKeyScope, validateApiKey } from '#utils/auth/apiKeys.ts'
import { hasHanasandInternalRouteAccess } from '#utils/auth/organizationPageAccess.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { customRetentionAction, recordCustomDropReceipts } from '#utils/events/customRetention.ts'
import { scanRulePreview, validPreviewWindow, PreviewRegexTimeout } from '#utils/events/rulePreview.ts'
import { cachedRead, ReadAdmissionError } from '#utils/readCache.ts'
import { bearer, normalizeParserVersion, object, readDatabase } from './shared.ts'
import { organizationAccess, loadConfiguredRules } from './ruleStorage.ts'
import { createFindings } from './findingEngine.ts'
import { normalizeEvent, validateEventFields } from './eventNormalization.ts'
import { normalizeConditions } from './sigma.ts'
import type { Event, EventBody, NormalizedEvent } from './types.ts'

export async function ingestEvent(req: FastifyRequest, res: FastifyReply) {
    const secret = bearer(req)
    const key = secret ? await validateApiKey(secret) : null
    if (!key?.organizationId || !matchApiKeyScope(key.apiKey.scopes, 'POST', '/mill')) {
        return res.status(401).send({ error: { code: 'event_authentication_required', message: 'Use an active organization API key with event intake access.' } })
    }

    const body = req.body as EventBody | undefined
    const events = Array.isArray(body?.events) ? body.events : body && typeof body === 'object' && !Array.isArray(body) ? [body] : []
    if (!events.length || events.some(event => !event || typeof event !== 'object' || Array.isArray(event))) {
        return res.status(400).send({ error: { code: 'invalid_event_payload', message: 'Send one JSON event or an events array containing JSON objects.' } })
    }
    if (events.length > 5000) {
        return res.status(413).send({ error: { code: 'event_batch_too_large', message: 'Requests can include at most 5,000 events.' } })
    }
    const invalidFields = validateEventFields(events as Event[])
    if (invalidFields.length) {
        return res.status(400).send({ error: { code: 'invalid_event_event_fields', message: 'Correct the invalid event fields and try again.', fields: invalidFields } })
    }

    const source = body?.source && typeof body.source === 'object' && !Array.isArray(body.source) ? body.source : {}
    const ingestionId = `event_${randomUUID()}`
    const configuredRules = await loadConfiguredRules(key.organizationId)
    const accepted: string[] = []
    let normalizedEvents = (events as Event[]).map(event => ({ normalized: normalizeEvent(event, source), eventId: randomUUID() }))
    const missingTimestamps = normalizedEvents.flatMap(({ normalized }, index) => normalized.timestamp
        ? []
        : [{ field: `events[${index}].timestamp`, message: 'timestamp is required and must be provided by the event.' }])
    if (missingTimestamps.length) {
        return res.status(400).send({ error: { code: 'invalid_event_event_fields', message: 'Correct the invalid event fields and try again.', fields: missingTimestamps } })
    }
    const receivedCount = normalizedEvents.length
    const retainedEvents = [] as typeof normalizedEvents
    for (const item of normalizedEvents) {
        if (customRetentionAction(item.normalized.normalized, configuredRules) === 'drop')
            await recordCustomDropReceipts(item.normalized.normalized, configuredRules, item.eventId, key.organizationId)
        else retainedEvents.push(item)
    }
    normalizedEvents = retainedEvents
    const droppedCount = receivedCount - normalizedEvents.length
    for (let offset = 0; offset < normalizedEvents.length; offset += 50) {
        await Promise.all(normalizedEvents.slice(offset, offset + 50).map(async ({ normalized, eventId }) => {
            await run(`
            INSERT INTO events (
                id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp,
                event_type, action, outcome, user_id, user_email, source_ip, source_country,
                source_city, device_id, normalized, original, parser_version, processing_status
            ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'pending')
            `, [
                eventId, ingestionId, key.organizationId, normalized.sourceVendor, normalized.sourceProduct,
                normalized.timestamp, normalized.eventType, normalized.action, normalized.outcome,
                normalized.userId, normalized.userEmail, normalized.sourceIp, normalized.sourceCountry,
                normalized.sourceCity, normalized.deviceId, JSON.stringify(normalized.normalized), JSON.stringify(normalized.original), normalized.parserVersion,
            ])
            accepted.push(eventId)
        }))
    }

    // Persist the complete batch before correlating it, including out-of-order payloads.
    for (const { normalized, eventId } of normalizedEvents.sort((a, b) => Date.parse(a.normalized.timestamp) - Date.parse(b.normalized.timestamp))) {
        await createFindings(key.organizationId, eventId, normalized, configuredRules)
        await run('UPDATE events SET processing_status = \'processed\' WHERE id = $1 AND organization_id = $2', [eventId, key.organizationId])
    }

    return res.status(202).send({ accepted: true, ingestion_id: ingestionId, accepted_events: receivedCount, stored_events: accepted.length, dropped_events: droppedCount, rejected_events: 0 })
}


async function canReadInternalEventLogs(req: FastifyRequest, res: FastifyReply, userId: string): Promise<boolean | null> {
    if (!req.headers.id) req.headers.id = userId
    const access = await hasHanasandInternalRouteAccess(req)
    return res.sent ? null : access.valid
}

export async function getEvents(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const query = req.query as { organizationId?: string, limit?: string }
    if (query.organizationId !== access.organizationId) return res.status(403).send({ error: 'Organization access denied.' })
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const canReadLogs = await canReadInternalEventLogs(req, res, access.userId)
    if (canReadLogs === null) return
    const events = await cachedRead(`events:${access.organizationId}:${canReadLogs ? 'logs' : 'no-logs'}:${limit}`, 5000, async () => {
        const result = await readDatabase(() => run(`
            SELECT id, ingestion_id, source_vendor, source_product, event_timestamp, received_at,
                   event_type, action, outcome, user_id, user_email, source_ip, source_country,
                   source_city, device_id, normalized, original, parser_version, processing_status
            FROM events
            WHERE organization_id = $1 AND ($3::boolean OR ingestion_id <> 'logs')
            ORDER BY event_timestamp DESC, received_at DESC
            LIMIT $2
        `, [access.organizationId, limit, canReadLogs]))
        return result.rows.map(row => ({ ...row, parser_version: normalizeParserVersion(row.parser_version) }))
    })
    return res.send({ organizationId: access.organizationId, events })
}

export async function postRulePreview(req: FastifyRequest, res: FastifyReply) {
    try {
        const access = await organizationAccess(req, res)
        if (!access) return res
        const body = (req.body || {}) as Record<string, unknown>
        const normalized = normalizeConditions(body.conditions)
        if (normalized.error || !normalized.conditions.length || !validPreviewWindow(body)) return res.status(400).send({ error: normalized.error || 'Choose a valid preview range and rule.' })
        const canReadLogs = await canReadInternalEventLogs(req, res, access.userId)
        if (canReadLogs === null) return res
        const storedLogsOnly = body.storedLogsOnly === true
        if (storedLogsOnly && !canReadLogs) return res.status(403).send({ error: 'Log access is required to preview stored log matches.' })
        return res.send(await scanRulePreview(access.organizationId, canReadLogs, { ...body, conditions: normalized.conditions }, undefined, { storedLogsOnly }))
    } catch (error) {
        if (res.sent) return res
        if (error instanceof PreviewRegexTimeout) return res.status(400).send({ error: error.message })
        const code = (error as { code?: string })?.code
        const message = (error as Error)?.message?.toLowerCase() || ''
        if (code === '57014') return res.header('Retry-After', '2').status(503).send({ error: 'Preview took too long to check. Narrow the time range or try again shortly.' })
        if (code === '53300' || code === '55P03' || code === '57P03' || code?.startsWith('08')
            || message.includes('connection timeout') || message.includes('timeout exceeded when trying to connect') || message.includes('timeout expired')
            || message.includes('connection terminated') || message.includes('connection refused') || message.includes('connection reset')
            || code === 'DB_QUEUE_FULL' || message.includes('database is temporarily busy'))
            return res.header('Retry-After', '2').status(503).send({ error: 'Preview is temporarily busy. Try again shortly.' })
        if (error instanceof ReadAdmissionError) return res.header('Retry-After', '2').status(503).send({ error: error.message })
        req.log?.error?.({ error }, 'Rule preview failed')
        return res.header('Retry-After', '2').status(503).send({ error: 'Preview is temporarily unavailable. Try again shortly.' })
    }
}

export async function postEventAction(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string }, Body: { action?: unknown } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (req.body?.action !== 'replay') return res.status(400).send({ error: 'Action must be replay.' })
    const result = await run(`
        SELECT id, ingestion_id, event_timestamp, event_type, action, outcome, user_id, user_email,
               source_ip, source_country, source_city, device_id, source_vendor, source_product,
               normalized, original, parser_version
        FROM events
        WHERE id = $1 AND organization_id = $2
    `, [req.params.id, access.organizationId])
    const row = result.rows[0]
    if (!row) return res.status(404).send({ error: 'Event not found.' })
    if (row.ingestion_id === 'logs' && !(await hasHanasandInternalRouteAccess(req)).valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })
    const event: NormalizedEvent = {
        timestamp: new Date(row.event_timestamp).toISOString(),
        eventType: String(row.event_type), action: String(row.action), outcome: String(row.outcome),
        userId: row.user_id ? String(row.user_id) : null, userEmail: row.user_email ? String(row.user_email) : null,
        sourceIp: row.source_ip ? String(row.source_ip) : null, sourceCountry: row.source_country ? String(row.source_country) : null,
        sourceCity: row.source_city ? String(row.source_city) : null, deviceId: row.device_id ? String(row.device_id) : null,
        sourceVendor: String(row.source_vendor), sourceProduct: String(row.source_product), parserVersion: normalizeParserVersion(row.parser_version),
        normalized: object(row.normalized), original: object(row.original),
    }
    await createFindings(access.organizationId, String(row.id), event, await loadConfiguredRules(access.organizationId))
    await recordSystemEvent(req, { actionType: 'event.event.replayed', actorId: access.userId, organizationId: access.organizationId, targetType: 'event_event', targetId: req.params.id, context: { eventType: event.eventType } })
    return res.send({ replayed: true, eventId: req.params.id })
}
