import { classifyApplicationError } from '../events/applicationError.ts'
import { analyzeCdnDelivery } from '../events/analyzeCdnDeliveryLog.ts'
import { analyzeIngestion } from '../events/analyzeIngestion.ts'
import { analyzeModelDiscovery, analyzeModelHealthCheck } from '../events/analyzeModelDiscoveryLog.ts'
import { analyzeReadinessAuditBatch } from '../events/analyzeReadinessAuditLog.ts'
import { analyzeCdnRefresh } from '../events/analyzeCdnRefreshLog.ts'
import { analyzeRoutineGroupBatch } from '../events/analyzeRoutineGroupBatch.ts'
import { analyzeCollectorExecution } from '../events/analyzeCollectorLog.ts'
import { analyzeProxy } from '../events/analyzeProxy.ts'
import run, { withTransaction } from '#db'
import { analyzePostgresBatch } from '../events/analyzePostgresBatch.ts'
import { customRetentionAction, loadLogRetentionRules, recordCustomDropReceipts } from '../events/customRetention.ts'
import { normalizeLogEvent } from '../events/logEvent.ts'
import { redactLogText, redactLogValue } from './redact.ts'
import { verifiedAccessFromLog } from '../events/analyzeAccess.ts'
import { analyzeAccess, analyzeMongoPing } from '../events/analyzeLog.ts'
import { recordProfileSshKeyUsageFromEvents } from '../sshKeyUsage.ts'
import { createHash, randomUUID } from 'node:crypto'
import { eventRow, insertEvents } from './recordLogPersistence.ts'
import type { LogRecordEntry, PreparedLog } from './recordLogTypes.ts'
import { enqueueLogsForIndependentService, logsOutboxEnabled, logsOutboxRemoteOnly } from './logOutbox.ts'

function requireRemoteLogsOutbox() {
    if (logsOutboxRemoteOnly() && !logsOutboxEnabled()) {
        throw new Error('LOGS_OUTBOX_REMOTE_ONLY requires LOGS_OUTBOX_ENABLED=1; refusing to lose application logs.')
    }
}

function preserveUnrecognizedFields(entry: LogRecordEntry) {
    const fields = Object.fromEntries(Object.entries(entry).filter(([key]) => !['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'].includes(key)))
    if (!Object.keys(fields).length) return entry
    const metadata = entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata) ? entry.metadata : {}
    // Preserve extras before destructuring or batch correlation can erase them.
    // Keep the original marker too if a caller already supplied one.
    return { ...entry, metadata: { ...metadata, unrecognized_ingest_fields: {
        fields, ...(Object.hasOwn(metadata, 'unrecognized_ingest_fields') ? { previous: metadata.unrecognized_ingest_fields } : {}),
    } } }
}

function isOrganizationRequest(metadata: Record<string, unknown>) {
    if (metadata.surface === 'organizations') return true
    return [metadata.path, metadata.url].some(value => {
        if (typeof value !== 'string') return false
        let path = value.split(/[?#]/, 1)[0]
        try {
            path = new URL(value, 'https://hanasand.invalid').pathname
        } catch {
            // The raw path is enough for the prefix check below.
        }
        return path === '/api/organizations'
            || path.startsWith('/api/organizations/')
    })
}

async function prepareLog({
    service = process.env.SERVICE_NAME || 'hanasand-api',
    host = process.env.HOSTNAME || 'local',
    level,
    message,
    metadata = {},
    sourceEventId,
    timestamp,
}: LogRecordEntry, query: typeof run = run, retention = new Map<string, Awaited<ReturnType<typeof loadLogRetentionRules>>>()): Promise<PreparedLog> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) metadata = {}
    const scopeId = typeof metadata.organizationId === 'string' && metadata.organizationId
        ? metadata.organizationId
        : typeof metadata.tenantId === 'string' && metadata.tenantId
            ? metadata.tenantId
            : null
    if (!retention.has(scopeId || '')) retention.set(scopeId || '', await loadLogRetentionRules(scopeId, query))
    const redactedMessage = redactLogText(message)
    const redactedMetadata = redactLogValue(metadata) as Record<string, unknown>
    const baseLog = { id: sourceEventId || '', service, host, level,
        message: redactedMessage, metadata: redactedMetadata, created_at: timestamp || new Date() }
    const baseNormalized = normalizeLogEvent(baseLog, undefined, { classify: false, includeSeverity: false })
    const retentionAction = Object.hasOwn(metadata, 'unrecognized_ingest_fields') ? 'keep' : customRetentionAction(baseNormalized, retention.get(scopeId || '')!)
    if (retentionAction === 'drop') {
        await recordCustomDropReceipts(baseNormalized, retention.get(scopeId || '')!, sourceEventId, scopeId || undefined, query)
        return
    }

    const classification = classifyApplicationError(baseLog, retention.get(scopeId || ''))
    if (classification) { level = classification.level; metadata = classification.metadata }
    const analyzerQuery = query === run ? undefined : query
    // Explicit Store exceptions must win before any built-in analyzer can drop.
    if (retentionAction !== 'keep') {
        if (await analyzeModelDiscovery({ service, host, level, message, metadata, sourceEventId, timestamp }, analyzerQuery)) return
        if (await analyzeModelHealthCheck({ service, host, level, message, metadata, sourceEventId, timestamp }, analyzerQuery)) return
        if (await analyzeCdnDelivery({ service, host, level, message, metadata, sourceEventId, timestamp }, analyzerQuery)) return
        if (await analyzeCdnRefresh({ service, host, level, message, metadata, sourceEventId, timestamp }, analyzerQuery)) return
        if (await analyzeCollectorExecution({ service, host, level, message, metadata, sourceEventId, timestamp }, analyzerQuery)) return
        if (await analyzeMongoPing({ service, host, level, message, metadata, sourceEventId }, analyzerQuery)) return
        const access = verifiedAccessFromLog({ service, host, level, message, metadata, sourceEventId, timestamp })
        if (access && await analyzeAccess(access, analyzerQuery)) return
    }
    message = redactedMessage
    metadata = redactedMetadata
    if (retentionAction !== 'keep' && await analyzeIngestion({ service, host, level, message, metadata, sourceEventId, timestamp }, analyzerQuery)) return
    if (retentionAction !== 'keep' && await analyzeProxy({ service, host, level, message, metadata, sourceEventId, timestamp }, analyzerQuery)) return
    if (!scopeId && isOrganizationRequest(metadata)) {
        service = 'hanasand-api'
        host = ''
        level = 'error'
        message = 'organization_request_error'
        metadata = { category: 'organization_request_error', surface: 'organizations' }
    }

    const identity = sourceEventId || randomUUID()
    return [service, host, level, message, JSON.stringify(metadata), scopeId, identity, timestamp || null,
        createHash('sha256').update(`service:${identity}`).digest('hex')]
}

export default async function recordLog(entry: LogRecordEntry, query: typeof run = run): Promise<string | undefined> {
    if (query === run) return withTransaction(async tx => {
        await tx('SET LOCAL lock_timeout=\'1ms\'')
        return recordLog(entry, tx)
    })
    const original = { ...preserveUnrecognizedFields(entry), sourceEventId: entry.sourceEventId || randomUUID() }
    requireRemoteLogsOutbox()
    await enqueueLogsForIndependentService([original], query)
    // The Logs API and worker own filtering and persistence in remote-only mode.
    // The Hanasand outbox remains a temporary durable transfer queue until the
    // production pipeline is verified and historical rows have been migrated.
    if (logsOutboxRemoteOnly()) return original.sourceEventId
    const values = await prepareLog(original, query)
    if (!values) return
    const row = eventRow(values)!
    const inserted = await insertEvents([row], query)
    return inserted[0]
}

// Keep analyzer decisions and the insert in the caller's transaction, while
// ordinary collector rows share one insert instead of 100 sequential round trips.
export async function recordLogBatch(entries: LogRecordEntry[], query: typeof run) {
    const rows: NonNullable<ReturnType<typeof eventRow>>[] = []
    const retention = new Map<string, Awaited<ReturnType<typeof loadLogRetentionRules>>>()
    const originals = entries.map(entry => ({ ...preserveUnrecognizedFields(entry),
        service: entry.service ?? process.env.SERVICE_NAME ?? 'hanasand-api', sourceEventId: entry.sourceEventId || randomUUID() }))
    requireRemoteLogsOutbox()
    await enqueueLogsForIndependentService(originals, query)
    // Avoid retaining a second processed copy in Hanasand while the durable
    // transfer outbox moves each batch to the independent Logs database.
    if (logsOutboxRemoteOnly()) return
    for (const entry of await analyzeRoutineGroupBatch(await analyzePostgresBatch(await analyzeReadinessAuditBatch(originals, query), query), query)) {
        const values = await prepareLog(entry, query, retention)
        const row = eventRow(values)
        if (row) rows.push(row)
    }
    if (!rows.length) return
    await insertEvents(rows, query)
    if (process.env.NODE_ENV === 'test') return
    const sshLogins = rows.filter(({ event }) => event.event_type === 'authentication'
        && event.action === 'login' && event.outcome === 'success'
        && event.service === 'sshd' && /^Accepted publickey for /.test(event.message)
        && ['inspur', 'hanasand', 'ovh', 'ovhcloud'].includes(String(event.host).toLowerCase().split('.')[0]))
    if (!sshLogins.length) return
    const platformOrganization = await query(`
        SELECT id FROM organizations
        WHERE status = 'active'
          AND (id = $1 OR ($1::text IS NULL AND lower(name) = 'hanasand'))
        ORDER BY created_at
        LIMIT 1
    `, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
    const platformId = platformOrganization.rows[0]?.id
    if (!platformId) return
    const platformLogins = sshLogins.filter(row => row.scopeId === null || row.scopeId === platformId)
    if (platformLogins.length) await recordProfileSshKeyUsageFromEvents(platformLogins.map(row => row.event))
}
