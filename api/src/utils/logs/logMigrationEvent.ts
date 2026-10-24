import { isDeepStrictEqual } from 'node:util'

type StoredLogEvent = {
    id: string
    organization_id: string
    event_timestamp: string | Date
    normalized: Record<string, unknown>
    source_vendor?: string | null
    source_product?: string | null
    received_at?: string | Date | null
    event_type?: string | null
    action?: string | null
    outcome?: string | null
    user_id?: string | null
    user_email?: string | null
    source_ip?: string | null
    source_country?: string | null
    source_city?: string | null
    device_id?: string | null
    original?: unknown
    parser_version?: string | null
    processing_status?: string | null
}

const validLevels = new Set(['debug', 'info', 'warn', 'error', 'fatal'])

export function logMigrationEvent(row: StoredLogEvent) {
    const normalized = row.normalized && typeof row.normalized === 'object' ? row.normalized : {}
    const sourceCandidate = typeof normalized.source_event_id === 'string' && normalized.source_event_id
        ? normalized.source_event_id : row.id
    const sourceEventId = sourceCandidate.length <= 256 ? sourceCandidate : row.id
    const sourceMetadata = normalized.metadata && typeof normalized.metadata === 'object' && !Array.isArray(normalized.metadata)
        ? normalized.metadata as Record<string, unknown> : {}
    const rawLevel = typeof normalized.level === 'string' ? normalized.level.toLowerCase() : ''
    const level = rawLevel === 'warning' ? 'warn' : rawLevel === 'critical' ? 'fatal'
        : validLevels.has(rawLevel) ? rawLevel : 'info'

    // Hanasand stores its event projection across top-level fields as well as
    // metadata. Lift every non-transport field into Logs metadata so Logs can
    // rebuild its searchable columns and rules can still see process/http/user
    // evidence. Preserve any source metadata value that conflicts with a
    // top-level projection or with the canonical organization scope.
    const metadata: Record<string, unknown> = { ...sourceMetadata }
    const originalMetadataConflicts: Record<string, unknown> = {}
    const transportFields = new Set(['service', 'host', 'level', 'message', 'timestamp', 'metadata'])
    for (const [key, value] of Object.entries(normalized)) {
        if (transportFields.has(key)) continue
        if (Object.hasOwn(metadata, key) && !isDeepStrictEqual(metadata[key], value)) {
            originalMetadataConflicts[key] = metadata[key]
        }
        metadata[key] = value
    }
    if (Object.hasOwn(metadata, 'organizationId') && metadata.organizationId !== row.organization_id) {
        originalMetadataConflicts.organizationId = metadata.organizationId
    }
    metadata.organizationId = row.organization_id

    const originalTransportFields: Record<string, unknown> = {}
    const service = (typeof normalized.service === 'string' && normalized.service ? normalized.service : 'hanasand-api').slice(0, 256)
    const host = (typeof normalized.host === 'string' ? normalized.host : '').slice(0, 256)
    const message = (typeof normalized.message === 'string' && normalized.message ? normalized.message : '(empty)').slice(0, 65_536)
    const timestamp = typeof normalized.timestamp === 'string' && Number.isFinite(Date.parse(normalized.timestamp))
        ? normalized.timestamp : new Date(row.event_timestamp).toISOString()
    for (const [key, mapped, original] of [
        ['service', service, normalized.service], ['host', host, normalized.host],
        ['level', level, normalized.level], ['message', message, normalized.message],
        ['timestamp', timestamp, normalized.timestamp],
    ] as const) {
        if (original !== undefined && !isDeepStrictEqual(mapped, original)) originalTransportFields[key] = original
    }
    if (typeof normalized.source_event_id === 'string' && normalized.source_event_id.length > 256) {
        originalTransportFields.source_event_id = normalized.source_event_id
    }
    if (Object.keys(originalMetadataConflicts).length || Object.keys(originalTransportFields).length) {
        let archiveKey = 'sourceHanasandMigrationOriginals'
        while (Object.hasOwn(metadata, archiveKey)) archiveKey = `_${archiveKey}`
        metadata[archiveKey] = {
            ...(Object.keys(originalMetadataConflicts).length ? { metadata: originalMetadataConflicts } : {}),
            ...(Object.keys(originalTransportFields).length ? { transport: originalTransportFields } : {}),
        }
    }

    const sourceRecordFields = [
        'source_vendor', 'source_product', 'received_at', 'event_type', 'action', 'outcome',
        'user_id', 'user_email', 'source_ip', 'source_country', 'source_city', 'device_id',
        'original', 'parser_version', 'processing_status',
    ] as const
    const sourceRecord = Object.fromEntries(sourceRecordFields
        .filter(key => Object.hasOwn(row, key))
        .map(key => [key, row[key]]))
    if (Object.keys(sourceRecord).length) {
        let sourceRecordKey = 'sourceHanasandRow'
        while (Object.hasOwn(metadata, sourceRecordKey)) sourceRecordKey = `_${sourceRecordKey}`
        metadata[sourceRecordKey] = { id: row.id, ingestion_id: 'logs', organization_id: row.organization_id,
            event_timestamp: row.event_timestamp, ...sourceRecord }
    }

    return {
        service,
        host,
        level,
        message,
        metadata,
        sourceEventId,
        timestamp,
    }
}
