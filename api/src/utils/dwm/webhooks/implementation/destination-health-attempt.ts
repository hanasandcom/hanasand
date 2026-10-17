import { buildDwmWebhookDeliveryLedger } from '../../webhookDeliveryLedger.ts'
import { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'

export function destinationHealthAttempt(
    attempt: ReturnType<typeof buildDwmWebhookDeliveryLedger>[number],
    auditEventId: string | null
) {
    return {
        requestId: attempt.requestId,
        deliveryId: attempt.deliveryId,
        alertId: attempt.alertId,
        eventType: attempt.eventType,
        status: attempt.status,
        rawStatus: attempt.rawStatus,
        dryRun: attempt.dryRun,
        live: attempt.live,
        liveRequested: attempt.liveRequested,
        replay: attempt.replay,
        idempotencyKey: attempt.idempotencyKey,
        dedupeKey: attempt.dedupeKey,
        route: attempt.route,
        casePath: attempt.casePath,
        responseStatus: attempt.responseStatus,
        responseSummary: attempt.responseSummary,
        error: attempt.error,
        errorClass: attempt.errorClass,
        retryable: attempt.retryable,
        nextRetryAt: attempt.nextRetryAt,
        retryReason: attempt.retryReason,
        attemptCount: attempt.attemptCount,
        payloadHash: attempt.payloadHash,
        auditEventId: attempt.auditEventId || auditEventId,
        auditAction: attempt.auditAction,
        attemptedAt: attempt.attemptedAt,
        createdAt: attempt.createdAt,
    }
}

export function hasTerminalDeliveryFailure(attempt: ReturnType<typeof destinationHealthAttempt> | null | undefined) {
    return Boolean(attempt && !attempt.retryable && attempt.errorClass !== 'live_delivery_disabled')
}

export function auditEventIdForDelivery(
    audits: ReturnType<typeof buildDwmWebhookAuditEventContracts>,
    deliveryId?: string | null
) {
    if (!deliveryId) return null
    return audits.find(audit => audit.deliveryId === deliveryId)?.auditEventId || null
}

export function lifecycleEvent(
    audit: ReturnType<typeof buildDwmWebhookAuditEventContracts>[number] | null,
    includeActor: boolean
) {
    if (!audit) return null
    return {
        auditEventId: audit.auditEventId,
        action: audit.action,
        outcome: audit.outcome,
        severity: audit.severity,
        actorId: includeActor ? audit.actorId : null,
        requestId: audit.requestId,
        createdAt: audit.createdAt,
    }
}
