import run from '#db'
import type { LogRecordEntry } from './recordLogTypes.ts'
import type { Organization } from './logOutboxTypes.ts'
import { logsOutboxEnabled, logsServiceConfiguration } from './logOutboxConfig.ts'
import { enqueueOrganizationSnapshots } from './logOutboxSnapshots.ts'
import { redactLogText, redactLogValue } from './redact.ts'
import { createHash, randomUUID } from 'node:crypto'

type Query = typeof run

function requestedOrganizationId(entry: LogRecordEntry) {
    const metadata = entry.metadata || {}
    return typeof metadata.organizationId === 'string' && metadata.organizationId
        ? metadata.organizationId
        : typeof metadata.tenantId === 'string' && metadata.tenantId ? metadata.tenantId : null
}

export async function enqueueLogsForIndependentService(entries: LogRecordEntry[], query: Query) {
    if (!logsOutboxEnabled() || !entries.length) return
    const config = logsServiceConfiguration()
    if (!config.url || !config.ingestToken || !config.syncToken) throw new Error('Logs outbox is enabled without its URL and service credentials.')

    const normalized = entries.map(entry => ({
        ...entry,
        service: entry.service || process.env.SERVICE_NAME || 'hanasand-api',
        host: entry.host || process.env.HOSTNAME || 'local',
        sourceEventId: createHash('sha256').update(`service:${entry.sourceEventId || randomUUID()}`).digest('hex'),
    }))
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
    await enqueueOrganizationSnapshots((organizations.rows as Organization[]).filter(item => snapshotIds.has(item.id)), query)

    if (prepared.length) await query(`INSERT INTO log_delivery_outbox(event_id, organization_id, payload)
        SELECT item.event_id, item.organization_id, item.payload FROM jsonb_to_recordset($1::jsonb) AS item(
            event_id text, organization_id text, payload jsonb) ON CONFLICT(event_id) DO NOTHING`,
    [JSON.stringify(prepared.map(item => ({ event_id: item.event.sourceEventId, organization_id: item.organizationId, payload: item.event })))])
}
