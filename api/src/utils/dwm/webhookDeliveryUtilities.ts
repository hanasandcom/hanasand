import type { DwmAlertEventType } from './webhookDestinationTypes.ts'
import { clean, recordOrEmpty } from './webhookValueUtils.ts'
import { redactWebhookEndpoint } from './webhookDestinationInput.ts'
import { toDwmWebhookDelivery } from './webhookDestinationModels.ts'
import { sanitizeCustomerOutboundText } from './customerOutputSafety.ts'

type PublicDelivery = ReturnType<typeof toDwmWebhookDelivery>

export function parseCount(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed)
    }
    return 0
}

export function deliveryAttemptState(status: PublicDelivery['status'], dryRun: boolean): 'queued' | 'sent' | 'failed' | 'skipped' {
    if (status === 'skipped') return 'skipped'
    if (dryRun) return 'queued'
    if (status === 'delivered') return 'sent'
    if (status === 'failed') return 'failed'
    return 'skipped'
}

export function deliveryRetryFilterState(delivery: PublicDelivery) {
    if (delivery.nextRetryAt) return 'retry_scheduled'
    if (delivery.status === 'delivered') return 'delivered'
    if (delivery.dryRun && delivery.status === 'dry_run') return 'dry_run'
    if (delivery.status === 'skipped') {
        if (delivery.errorClass === 'duplicate_delivered_idempotency_key') return 'dedupe_already_delivered'
        if (delivery.errorClass === 'live_delivery_disabled') return 'live_delivery_disabled'
        return 'skipped'
    }
    if (delivery.status === 'failed') return 'terminal_failure'
    return 'none'
}

export function extractHanasandPayloadContext(payload: unknown) {
    return recordOrEmpty(recordOrEmpty(payload)._hanasand)
}

export function dedupeFromIdempotencyKey(value: string) {
    const parts = value.split(':')
    return parts.length >= 4 ? parts.slice(3).join(':') : value
}

export function idempotencyCoverage(attempts: Array<{ idempotencyKey?: string | null }>) {
    const keys = attempts.map(attempt => clean(attempt.idempotencyKey)).filter(Boolean)
    const groups = new Map<string, number>()
    for (const key of keys) groups.set(key, (groups.get(key) || 0) + 1)
    return {
        attemptCount: attempts.length,
        coveredAttemptCount: keys.length,
        covered: attempts.length === 0 || keys.length === attempts.length,
        duplicateKeyCount: [...groups.values()].filter(count => count > 1).length,
    }
}

export function truncate(value: string, max: number) {
    return value.length > max ? `${value.slice(0, max - 3)}...` : value
}

export function redactDeliveryEvidenceText(value: string) {
    const endpointRefs: string[] = []
    const textWithEndpointRefs = value.replace(/\bhttps?:\/\/discord(?:app)?\.com\/api\/webhooks\/[^\s"'<>]+/gi, match => {
        const trailingPunctuation = match.match(/[,!?;:)]+$/)?.[0] || ''
        const endpoint = trailingPunctuation ? match.slice(0, -trailingPunctuation.length) : match
        const marker = `DWMENDPOINTREF${endpointRefs.length}SAFE`
        endpointRefs.push(`${redactWebhookEndpoint(endpoint)}${trailingPunctuation}`)
        return marker
    })

    return sanitizeCustomerOutboundText(textWithEndpointRefs)
        .replace(/DWMENDPOINTREF(\d+)SAFE/g, (marker, index: string) => endpointRefs[Number(index)] || marker)
}

export function sanitizeDwmWebhookDeliveryDiagnostic(value: unknown, max = 2000) {
    const text = clean(value)
    return text ? redactDeliveryEvidenceText(truncate(text, max)) : null
}

export function redactNullableDeliveryText(value: string | null) {
    return value ? redactDeliveryEvidenceText(value) : null
}

export function buildIdempotencyKey(eventType: DwmAlertEventType, orgId: string, destinationId: string, dedupeKey: string) {
    return `${eventType}:${orgId}:${destinationId}:${dedupeKey}`
}
