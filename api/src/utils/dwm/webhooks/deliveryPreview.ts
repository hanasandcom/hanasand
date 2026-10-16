import type { toDwmWebhookDelivery } from '../webhookDestinationModels.ts'
import { clean, recordOrEmpty } from '../webhookValueUtils.ts'
import { dedupeFromIdempotencyKey, extractHanasandPayloadContext, parseCount, redactDeliveryEvidenceText, truncate } from '../webhookDeliveryUtilities.ts'
import { planDwmWebhookDeliveryRetry } from '../webhookDeliveryRetryPolicy.ts'
import { deliveryAuditActionForEvent } from '../webhookAuditContracts.ts'
import { buildSanitizedDwmWebhookPayloadPreview } from './payloadPreviews.ts'

type DwmWebhookDeliveryPublic = ReturnType<typeof toDwmWebhookDelivery>

export function buildDwmWebhookDeliveryPreview(delivery: DwmWebhookDeliveryPublic) {
    const context = extractHanasandPayloadContext(delivery.payload)
    const payloadAlert = recordOrEmpty(context.alert)
    const payloadWatchlist = recordOrEmpty(context.watchlist)
    const payloadDelivery = recordOrEmpty(context.delivery)
    const embeds = Array.isArray((delivery.payload as Record<string, unknown> | undefined)?.embeds)
        ? (delivery.payload as Record<string, unknown>).embeds
        : []
    const retryPlan = planDwmWebhookDeliveryRetry({
        status: delivery.status,
        dryRun: delivery.dryRun,
        responseStatus: delivery.responseStatus,
        error: delivery.error,
        attemptedAt: delivery.attemptedAt,
        attemptCount: delivery.attemptCount || 1,
    })

    return {
        requestId: delivery.id,
        status: delivery.status,
        dryRun: delivery.dryRun,
        live: !delivery.dryRun && delivery.status !== 'skipped',
        destination: {
            id: delivery.destinationId,
            endpointHint: redactDeliveryEvidenceText(delivery.endpointHint),
            endpointHash: delivery.endpointHash,
        },
        payload: delivery.payload,
        sanitizedPayloadPreview: buildSanitizedDwmWebhookPayloadPreview(delivery, context, embeds),
        discord: {
            content: clean((delivery.payload as Record<string, unknown> | undefined)?.content),
            embeds,
            allowedMentions: (delivery.payload as Record<string, unknown> | undefined)?.allowed_mentions || null,
        },
        context: {
            org: recordOrEmpty(context.org),
            watchlist: payloadWatchlist,
            alert: {
                id: clean(payloadAlert.id) || delivery.alertId,
                title: clean(payloadAlert.title),
                severity: clean(payloadAlert.severity),
                sourceFamily: clean(payloadAlert.sourceFamily),
                evidenceCount: parseCount(payloadAlert.evidenceCount),
                provenance: payloadAlert.provenance || null,
                dedupeKey: clean(payloadAlert.dedupeKey) || clean(payloadDelivery.dedupeKey) || dedupeFromIdempotencyKey(delivery.idempotencyKey),
                casePath: clean(payloadAlert.casePath) || clean(payloadDelivery.casePath) || delivery.casePath,
                alertUrl: clean(payloadAlert.alertUrl) || clean(payloadDelivery.alertUrl),
                caseId: clean(payloadAlert.caseId) || clean(payloadAlert.caseIdCandidate),
                caseActionId: clean(payloadAlert.caseActionId) || clean(payloadDelivery.caseActionId),
                caseActionPath: clean(payloadAlert.caseActionPath) || clean(payloadDelivery.caseActionPath),
            },
            delivery: payloadDelivery,
            links: {
                casePath: clean(payloadDelivery.casePath) || clean(payloadAlert.casePath) || delivery.casePath,
                alertUrl: clean(payloadDelivery.alertUrl) || clean(payloadAlert.alertUrl),
            },
        },
        operationLinks: buildDwmWebhookDeliveryOperationLinks(delivery),
        response: {
            httpStatus: delivery.responseStatus,
            summary: delivery.responseBody ? redactDeliveryEvidenceText(truncate(delivery.responseBody, 500)) : null,
        },
        error: delivery.error ? redactDeliveryEvidenceText(truncate(delivery.error, 500)) : null,
        retry: {
            retryable: Boolean(delivery.nextRetryAt) || retryPlan.retryable,
            nextRetryAt: delivery.nextRetryAt || retryPlan.nextRetryAt,
            errorClass: delivery.errorClass || retryPlan.errorClass,
            attemptCount: delivery.attemptCount || 1,
            reason: retryPlan.reason,
            persisted: Boolean(delivery.errorClass || delivery.attemptCount || delivery.nextRetryAt),
        },
        audit: {
            auditEventId: null,
            expectedAction: deliveryAuditActionForEvent(delivery.eventType),
        },
        payloadHash: delivery.payloadHash,
        idempotencyKey: delivery.idempotencyKey,
        timestamps: {
            attemptedAt: delivery.attemptedAt,
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt || delivery.createdAt,
        },
    }
}

export function buildDwmWebhookDeliveryOperationLinks(delivery: DwmWebhookDeliveryPublic) {
    const orgId = encodeURIComponent(delivery.orgId)
    const deliveryId = encodeURIComponent(delivery.id)
    const alertId = encodeURIComponent(delivery.alertId)
    const destinationId = delivery.destinationId ? encodeURIComponent(delivery.destinationId) : null
    const dedupeKey = delivery.idempotencyKey ? encodeURIComponent(dedupeFromIdempotencyKey(delivery.idempotencyKey) || delivery.idempotencyKey) : null
    return {
        deliveryDetail: `GET /api/dwm/webhook-deliveries?orgId=${orgId}&deliveryId=${deliveryId}`,
        deliveryHistory: destinationId
            ? `GET /api/dwm/webhook-deliveries?orgId=${orgId}&destinationId=${destinationId}&alertId=${alertId}`
            : `GET /api/dwm/webhook-deliveries?orgId=${orgId}&alertId=${alertId}`,
        retryDryRun: 'POST /api/dwm/webhook-deliveries',
        destinationTest: destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : null,
        destinationDetail: destinationId ? `GET /api/dwm/webhooks?orgId=${orgId}&destinationId=${destinationId}` : null,
        destinationDelete: destinationId ? `DELETE /api/dwm/webhook-destinations/${destinationId}` : null,
        destinationArchive: destinationId ? `DELETE /api/dwm/webhook-destinations/${destinationId}` : null,
        dedupeHistory: dedupeKey ? `GET /api/dwm/webhook-deliveries?orgId=${orgId}&dedupeKey=${dedupeKey}` : null,
        casePath: delivery.casePath || null,
    }
}
