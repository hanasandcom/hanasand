import { safeEvidenceExcerpt } from '@/utils/dwm/display'
import type { DeliveryItem } from './types'
import { orderDeliveries } from './delivery-panel'
import { relativeTimeLabel, stateLabel } from './case-format'

export async function readPayload(response: Response): Promise<{ error?: { message?: string }, attemptedCount?: number, case?: { id?: string }, alertCaseHandoff?: { caseId?: string }, delivery?: DeliveryItem, deliveries?: DeliveryItem[] }> {
    return await response.json().catch(() => ({}))
}

export function mergeDeliveries(incoming: DeliveryItem[], current: DeliveryItem[]) {
    const rows = [...incoming, ...current]
    const seen = new Set<string>()
    return orderDeliveries(rows
        .filter(row => {
            if (!row?.id || seen.has(row.id)) return false
            seen.add(row.id)
            return true
        }))
}

export function deliveryActionMessage(rows: DeliveryItem[], fallback: string) {
    const row = rows[0]
    if (!row) return `${fallback} blocked: no durable delivery result was returned.`
    const destination = destinationLabel(row)
    const retry = row.nextRetryAt ? ` Retry ${relativeTimeLabel(row.nextRetryAt)}.` : ''
    const error = row.error ? ` ${safeEvidenceExcerpt(row.error)}` : ''
    const trace = row.auditEventId || row.requestId ? ` Trace ${row.auditEventId || row.requestId}.` : ''
    return `${fallback} ${stateLabel(row.status)} for ${destination}.${retry}${error}${trace}`
}


function destinationLabel(row: Pick<DeliveryItem, 'endpointHint' | 'endpointHash' | 'webhookDestinationId' | 'destinationId'>) {
    if (row.endpointHint || row.endpointHash) return 'configured destination'
    if (row.webhookDestinationId || row.destinationId) return 'saved destination'
    return 'redacted destination'
}
