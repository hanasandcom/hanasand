import run from '#db'
import type { LogRecordEntry } from './recordLogTypes.ts'
import type { Organization } from './logOutboxTypes.ts'
import { logsOutboxEnabled, logsServiceConfiguration, logsServiceDirect } from './logOutboxConfig.ts'
import { enqueueOrganizationSnapshots } from './logOutboxSnapshots.ts'
import { redactLogText, redactLogValue } from './redact.ts'
import { createHash, createHmac, randomUUID } from 'node:crypto'

type Query = typeof run
const applicationLogEnvelopeSchema = 'hanasand.application-log.v1'
const applicationLogEnvelopePrefix = 'HANASAND_APPLICATION_LOG_V1 '
const maxApplicationLogEnvelopeBytes = 360_000
const maxApplicationLogTextFieldLength = 256
const maxApplicationLogMessageLength = 65_536
const applicationLogLevels = new Set(['debug', 'info', 'warn', 'error', 'fatal'])

export function normalizeApplicationLogEvent(entry: LogRecordEntry) {
    const normalization: Record<string, unknown> = {}
    const sourceService = typeof entry.service === 'string' && entry.service
        ? entry.service : process.env.SERVICE_NAME || 'hanasand-api'
    const service = sourceService.slice(0, maxApplicationLogTextFieldLength)
    if (service !== sourceService) normalization.serviceTruncated = true

    const sourceHost = typeof entry.host === 'string' && entry.host
        ? entry.host : process.env.HOSTNAME || 'local'
    const host = sourceHost.slice(0, maxApplicationLogTextFieldLength)
    if (host !== sourceHost) normalization.hostTruncated = true

    const level = typeof entry.level === 'string' && applicationLogLevels.has(entry.level) ? entry.level : 'info'
    if (level !== entry.level) normalization.levelReplaced = true

    const fullMessage = redactLogText(typeof entry.message === 'string' ? entry.message : String(entry.message ?? ''))
    const message = (fullMessage || '[empty application log message]').slice(0, maxApplicationLogMessageLength)
    if (!fullMessage) normalization.emptyMessageReplaced = true
    if (fullMessage.length > maxApplicationLogMessageLength) {
        normalization.messageTruncated = true
        normalization.originalMessageLength = fullMessage.length
        normalization.originalMessageSha256 = createHash('sha256').update(fullMessage).digest('hex')
    }

    const sourceEventId = typeof entry.sourceEventId === 'string' && entry.sourceEventId
        ? entry.sourceEventId : randomUUID()
    const safeSourceEventId = sourceEventId.length <= maxApplicationLogTextFieldLength ? sourceEventId
        : `hanasand-${createHash('sha256').update(sourceEventId).digest('hex')}`
    if (safeSourceEventId !== sourceEventId) {
        normalization.sourceEventIdHashed = true
        normalization.originalSourceEventIdSha256 = createHash('sha256').update(sourceEventId).digest('hex')
    }

    const timestamp = typeof entry.timestamp === 'string' && entry.timestamp.length <= maxApplicationLogTextFieldLength
        && Number.isFinite(Date.parse(entry.timestamp)) ? entry.timestamp : new Date().toISOString()
    if (timestamp !== entry.timestamp) normalization.timestampReplaced = true

    const redactedMetadata = redactLogValue(entry.metadata || {})
    const metadata = redactedMetadata && typeof redactedMetadata === 'object' && !Array.isArray(redactedMetadata)
        ? redactedMetadata as Record<string, unknown> : {}
    if (metadata !== redactedMetadata) normalization.metadataReplaced = true
    if (Object.keys(normalization).length) {
        let key = 'hanasandProducerNormalization'
        while (Object.hasOwn(metadata, key)) key = `_${key}`
        metadata[key] = normalization
    }

    return { service, host, level, message, metadata, sourceEventId: safeSourceEventId, timestamp }
}

export function serializeApplicationLogEnvelope(entry: LogRecordEntry) {
    const event = normalizeApplicationLogEvent(entry)
    const signingKey = process.env.LOGS_APPLICATION_LOG_HMAC_KEY
    if (!signingKey || Buffer.byteLength(signingKey) < 32) {
        throw new Error('Direct Logs delivery requires a valid LOGS_APPLICATION_LOG_HMAC_KEY.')
    }
    const signature = createHmac('sha256', signingKey).update(JSON.stringify(event)).digest('hex')
    const envelope = JSON.stringify({ schema: applicationLogEnvelopeSchema, event, signature })
    if (Buffer.byteLength(envelope) > maxApplicationLogEnvelopeBytes) {
        throw new Error('A Hanasand application log exceeds the collector envelope size limit.')
    }
    return `${applicationLogEnvelopePrefix}${Buffer.from(envelope).toString('base64url')}`
}

function requestedOrganizationId(entry: LogRecordEntry) {
    const metadata = entry.metadata || {}
    return typeof metadata.organizationId === 'string' && metadata.organizationId
        ? metadata.organizationId
        : typeof metadata.tenantId === 'string' && metadata.tenantId ? metadata.tenantId : null
}

export async function publishLogsToIndependentService(entries: LogRecordEntry[], query: Query) {
    if ((!logsOutboxEnabled() && !logsServiceDirect()) || !entries.length) return

    const normalized = entries.map(entry => ({
        ...entry,
        service: entry.service || process.env.SERVICE_NAME || 'hanasand-api',
        host: entry.host || process.env.HOSTNAME || 'local',
        // Logs computes the same stable event primary key as Hanasand from this
        // source identity. Hashing it here would double-hash the Logs key and
        // make dual-write migration create a second copy of each application log.
        sourceEventId: entry.sourceEventId || randomUUID(),
    }))
    if (logsServiceDirect()) {
        // The host collector reads container stdout into its durable queue and
        // sends the event to Logs. Hanasand does not open a DB or HTTP dependency.
        for (const entry of normalized) console.info(serializeApplicationLogEnvelope(entry))
        return
    }
    const config = logsServiceConfiguration()
    if (!config.url || !config.ingestToken || !config.syncToken) {
        throw new Error('Logs outbox is enabled without its URL and service credentials.')
    }
    const requestedIds = [...new Set(normalized.map(requestedOrganizationId).filter((id): id is string => Boolean(id)))]
    const platformId = process.env.PLATFORM_LOG_ORGANIZATION_ID || null
    const organizations = await query(`SELECT id, name, status, retention_days, audit_safe_metadata, updated_at
        FROM organizations
        WHERE id = ANY($1::text[])
           OR (status = 'active' AND (id = $2 OR ($2::text IS NULL AND lower(name) = 'hanasand')))
        ORDER BY id`, [requestedIds, platformId])
    const byId = new Map((organizations.rows as Organization[]).map(item => [item.id, item]))
    const platform = organizations.rows.find((item: Organization) => item.status === 'active'
        && (item.id === platformId || (platformId === null && item.name.toLowerCase() === 'hanasand'))) as Organization | undefined
    if (!platform) throw new Error('Logs outbox cannot resolve the active platform organization.')

    const targetIds = new Set<string>()
    const prepared = normalized.map(entry => {
        const requestedId = requestedOrganizationId(entry)
        const requested = requestedId ? byId.get(requestedId) : undefined
        const deleted = Boolean(requested && (requested.status === 'deleted' || Object.hasOwn(requested.audit_safe_metadata || {}, 'privacyDeletedAt')))
        const unresolvedScope = Boolean(requestedId && (!requested || requested.status !== 'active'))
        const target = requested?.status === 'active' && !deleted ? requested : platform
        const organizationId = target.id
        targetIds.add(organizationId)

        if (deleted || unresolvedScope) {
            const metadata = {
                category: deleted ? 'organization_privacy' : 'organization_scope',
                action: deleted ? 'post_delete_event' : 'unresolved_scope_event',
                organizationId, tenantId: organizationId, outcome: 'recorded',
                ...(deleted ? {} : { requestedOrganizationId: requestedId, requestedOrganizationStatus: requested?.status || 'missing' }),
                privacyDeletionRunId: requested?.audit_safe_metadata?.privacyDeletionRunId,
            }
            return {
                event: {
                    service: 'hanasand-api', host: '', level: deleted ? 'info' : 'error', message: 'organization_event',
                    metadata: redactLogValue(metadata), sourceEventId: entry.sourceEventId!,
                    timestamp: entry.timestamp || new Date().toISOString(),
                },
                organizationId,
            }
        }

        const metadata = redactLogValue({ ...(entry.metadata || {}), organizationId, tenantId: organizationId })
        return {
            event: {
                service: entry.service!, host: entry.host!, level: entry.level || 'info',
                message: redactLogText(entry.message), metadata,
                sourceEventId: entry.sourceEventId!, timestamp: entry.timestamp || new Date().toISOString(),
            },
            organizationId,
        }
    })
    const snapshotIds = new Set([...targetIds, ...requestedIds])
    const snapshots = (organizations.rows as Organization[]).filter(item => snapshotIds.has(item.id))
    await enqueueOrganizationSnapshots(snapshots, query)

    if (prepared.length) await query(`INSERT INTO log_delivery_outbox(event_id, organization_id, payload)
        SELECT item.event_id, item.organization_id, item.payload FROM jsonb_to_recordset($1::jsonb) AS item(
            event_id text, organization_id text, payload jsonb) ON CONFLICT(event_id) DO NOTHING`,
    [JSON.stringify(prepared.map(item => ({ event_id: item.event.sourceEventId, organization_id: item.organizationId, payload: item.event })))])
}
