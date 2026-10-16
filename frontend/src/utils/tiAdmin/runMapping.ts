import type { TiAdminRun, TiAdminSource } from './types'
import type { ApiPayload } from './values'
import { isoValue, listValue, numberValue, objectValue, optionalIso, stringValue, textValue } from './values'

export function toRun(record: ApiPayload, sources: Map<string, TiAdminSource>): TiAdminRun | undefined {
    const id = stringValue(record.id)
    const sourceId = stringValue(record.sourceId) || listValue(record.sourceIds).map(item => stringValue(item)).find(Boolean) || ''
    const startedAt = isoValue(record.startedAt, record.createdAt)
    if (!id || !startedAt) return undefined
    const source = sources.get(sourceId)
    return {
        id,
        sourceId,
        sourceName: textValue(record.sourceName, source?.name, sourceId ? sourceId : 'Global source fleet'),
        sourceFamily: textValue(record.sourceFamily, source?.family, sourceId ? 'source' : 'collection'),
        sourceUrl: source?.url || '',
        status: runStatus(record.status),
        startedAt,
        finishedAt: optionalIso(record.finishedAt, record.completedAt, record.updatedAt),
        nextRunAt: isoValue(record.nextRunAt, source?.nextRunAt),
        rows: numberValue(record.rows, record.rowCount, record.processedCount, record.itemCount),
        captures: numberValue(record.captures, record.captureCount),
        screenshots: numberValue(record.screenshots, record.screenshotCount),
        message: textValue(record.message, record.error),
        trigger: textValue(record.trigger, objectValue(record.metadata).trigger, '') === 'automated' ? 'automated' : textValue(record.trigger, objectValue(record.metadata).trigger, '') === 'manual' ? 'manual' : 'unknown',
    }
}

function runStatus(value: unknown): TiAdminRun['status'] {
    const status = stringValue(value).toLowerCase()
    if (['queued', 'pending'].includes(status)) return 'queued'
    if (['running', 'leased', 'processing'].includes(status)) return 'running'
    if (['failed', 'error', 'dead_letter'].includes(status)) return 'failed'
    return 'completed'
}
