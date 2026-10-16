import { clean } from './webhookValueUtils.ts'
import { toDwmWebhookDelivery } from './webhookDestinationModels.ts'

type DeliveryStatus = ReturnType<typeof toDwmWebhookDelivery>['status']

export const MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS = 5

export function classifyDeliveryError({
    status,
    dryRun,
    responseStatus,
    error,
}: {
    status: DeliveryStatus
    dryRun: boolean
    responseStatus?: number | null
    error?: string | null
}) {
    const message = clean(error).toLowerCase()
    if (dryRun || status === 'delivered') return null
    if (message.includes('live dwm webhook delivery is disabled')) return 'live_delivery_disabled'
    if (message.includes('attempt limit')) return 'delivery_attempt_limit'
    if (responseStatus) {
        if (responseStatus === 408) return 'timeout'
        if (responseStatus === 429) return 'rate_limited'
        if (responseStatus >= 500) return 'upstream_5xx'
        if (responseStatus >= 400) return 'upstream_4xx'
    }
    if (message.includes('timeout') || message.includes('abort')) return 'timeout'
    if (message.includes('network') || message.includes('fetch') || message.includes('econn')) return 'network_error'
    if (status === 'skipped') return 'skipped'
    return status === 'failed' ? 'unknown_failure' : null
}

function retryDelayMs(attemptCount: number) {
    const delays = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000]
    return delays[Math.min(Math.max(1, attemptCount), delays.length) - 1]
}

export function planDwmWebhookDeliveryRetry({
    status,
    dryRun,
    responseStatus,
    error,
    attemptedAt,
    attemptCount = 1,
    now = new Date(),
}: {
    status: DeliveryStatus
    dryRun: boolean
    responseStatus?: number | null
    error?: string | null
    attemptedAt?: string | null
    attemptCount?: number
    now?: Date
}) {
    const errorClass = classifyDeliveryError({ status, dryRun, responseStatus, error })
    if (dryRun) {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'dry_run_no_external_send' }
    }
    if (status === 'delivered') {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'already_sent' }
    }
    if (status === 'skipped') {
        return { retryable: false, nextRetryAt: null, errorClass, reason: errorClass === 'live_delivery_disabled' ? 'live_delivery_disabled' : 'skipped_not_retryable' }
    }
    if (status !== 'failed') {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'not_failed' }
    }
    if (responseStatus && responseStatus >= 400 && responseStatus < 500 && responseStatus !== 408 && responseStatus !== 429) {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'non_retryable_http_status' }
    }
    if (attemptCount >= MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS) {
        return { retryable: false, nextRetryAt: null, errorClass, reason: 'retry_limit_reached' }
    }

    const base = attemptedAt ? new Date(attemptedAt) : now
    const nextRetryAt = new Date(base.getTime() + retryDelayMs(attemptCount)).toISOString()
    return {
        retryable: true,
        nextRetryAt,
        errorClass,
        reason: responseStatus === 429 ? 'rate_limited' : responseStatus && responseStatus >= 500 ? 'upstream_retryable' : 'network_retryable',
    }
}
