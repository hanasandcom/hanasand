import type { DwmWebhookDeliveryEvidenceFilters } from './webhooks/sharedTypes.ts'
import { toDwmWebhookAuditEvent, toDwmWebhookDelivery } from './webhookDestinationModels.ts'
import { buildDwmWebhookDeliveryEvidenceProjection } from './webhookDeliveryEvidence.ts'
import { deliveryAttemptState } from './webhookDeliveryUtilities.ts'
import { planDwmWebhookDeliveryRetry } from './webhookDeliveryRetryPolicy.ts'

type PublicDelivery = ReturnType<typeof toDwmWebhookDelivery>
type PublicAudit = ReturnType<typeof toDwmWebhookAuditEvent>
type DeliveryProjection = ReturnType<typeof buildDwmWebhookDeliveryEvidenceProjection>

export function buildDwmWebhookDeliveryEvidenceAndLedger({
    deliveries,
    auditEvents = [],
    filters = {},
    now = new Date(),
}: {
    deliveries: PublicDelivery[]
    auditEvents?: PublicAudit[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    now?: Date
}) {
    const projection = buildDwmWebhookDeliveryEvidenceProjection({ deliveries, auditEvents, filters })
    return {
        evidence: projection.evidence,
        ledger: buildDwmWebhookDeliveryLedgerFromEvidence({ projection, now }),
    }
}

export function buildDwmWebhookDeliveryLedger({
    deliveries,
    auditEvents = [],
    filters = {},
    now = new Date(),
}: {
    deliveries: PublicDelivery[]
    auditEvents?: PublicAudit[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    now?: Date
}) {
    const projection = buildDwmWebhookDeliveryEvidenceProjection({ deliveries, auditEvents, filters })
    return buildDwmWebhookDeliveryLedgerFromEvidence({ projection, now })
}

export function buildDwmWebhookDeliveryLedgerFromEvidence({
    projection,
    now,
}: {
    projection: DeliveryProjection
    now: Date
}) {
    const { evidence, deliveriesById, attemptCountsByIdempotencyKey } = projection
    return evidence.map((item) => {
        const delivery = deliveriesById.get(item.deliveryId)!
        const retryPlan = planDwmWebhookDeliveryRetry({
            status: delivery.status,
            dryRun: delivery.dryRun,
            responseStatus: delivery.responseStatus,
            error: delivery.error,
            attemptedAt: delivery.attemptedAt,
            attemptCount: attemptCountsByIdempotencyKey.get(delivery.idempotencyKey || delivery.id) || 1,
            now,
        })
        const attemptCount = delivery.attemptCount || attemptCountsByIdempotencyKey.get(delivery.idempotencyKey || delivery.id) || 1
        const errorClass = delivery.errorClass ?? retryPlan.errorClass
        const nextRetryAt = delivery.nextRetryAt ?? retryPlan.nextRetryAt

        return {
            requestId: item.requestId,
            deliveryId: item.deliveryId,
            destinationId: item.destinationId,
            orgId: item.orgId,
            alertId: item.alertId,
            eventType: item.eventType,
            status: deliveryAttemptState(item.status, item.dryRun),
            rawStatus: item.status,
            dryRun: item.dryRun,
            live: item.live,
            liveRequested: item.liveRequested,
            replay: item.replay,
            idempotencyKey: item.idempotencyKey,
            dedupeKey: item.dedupeKey,
            watchlistId: item.watchlistId,
            watchlistName: item.watchlistName,
            route: item.route,
            casePath: item.casePath,
            caseActionId: item.caseActionId,
            caseActionPath: item.caseActionPath,
            redactedEndpointLabel: item.redactedDestination.endpointHint,
            redactedDestination: item.redactedDestination,
            responseStatus: item.response.httpStatus,
            responseSummary: item.response.summary,
            error: item.error,
            errorClass,
            attemptCount,
            attemptedAt: item.attemptedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            nextRetryAt,
            retryState: item.retryState,
            retryable: Boolean(nextRetryAt) || retryPlan.retryable,
            retryReason: retryPlan.reason,
            payloadHash: item.payloadHash,
            auditEventId: item.auditEventId,
            auditAction: item.auditAction,
            actorId: item.actorId,
            reportValidation: item.reportValidation,
            reportExportChecksum: item.reportExportChecksum,
            reportCaseId: item.reportCaseId,
            thirdPartyReport: item.thirdPartyReport,
        }
    })
}
