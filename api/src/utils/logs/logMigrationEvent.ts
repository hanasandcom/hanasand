type StoredLogEvent = {
    id: string
    organization_id: string
    event_timestamp: string | Date
    normalized: Record<string, unknown>
}

const validLevels = new Set(['debug', 'info', 'warn', 'error', 'fatal'])

export function logMigrationEvent(row: StoredLogEvent) {
    const normalized = row.normalized && typeof row.normalized === 'object' ? row.normalized : {}
    const sourceCandidate = typeof normalized.source_event_id === 'string' && normalized.source_event_id
        ? normalized.source_event_id : row.id
    const sourceEventId = sourceCandidate.length <= 256 ? sourceCandidate : row.id
    const metadata = normalized.metadata && typeof normalized.metadata === 'object' && !Array.isArray(normalized.metadata)
        ? normalized.metadata as Record<string, unknown> : {}
    const rawLevel = typeof normalized.level === 'string' ? normalized.level.toLowerCase() : ''
    const level = rawLevel === 'warning' ? 'warn' : rawLevel === 'critical' ? 'fatal'
        : validLevels.has(rawLevel) ? rawLevel : 'info'

    return {
        service: (typeof normalized.service === 'string' && normalized.service ? normalized.service : 'hanasand-api').slice(0, 256),
        host: (typeof normalized.host === 'string' ? normalized.host : '').slice(0, 256),
        level,
        message: (typeof normalized.message === 'string' && normalized.message ? normalized.message : '(empty)').slice(0, 65_536),
        metadata: { ...metadata, organizationId: row.organization_id },
        sourceEventId,
        timestamp: typeof normalized.timestamp === 'string' && Number.isFinite(Date.parse(normalized.timestamp))
            ? normalized.timestamp : new Date(row.event_timestamp).toISOString(),
    }
}
