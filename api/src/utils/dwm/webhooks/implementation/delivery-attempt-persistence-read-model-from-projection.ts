import { buildDwmWebhookDeliveryOperationLinks } from '../deliveryPreview.ts'
import { buildDwmWebhookDestinationTestPayloadPreview } from '../payloadPreviews.ts'
import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { clean } from '../../webhookValueUtils.ts'
import { dedupeFromIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { planDwmWebhookDeliveryRetry } from '../../webhookDeliveryRetryPolicy.ts'
import { type DwmWebhookDeliveryEvidenceOptions } from './webhook-contract-types.ts'
import { type DwmWebhookDeliveryProjectionContext } from './webhook-visibility-decision.ts'

export function buildDwmWebhookDeliveryAttemptPersistenceReadModelFromProjection({
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    context,
}: Pick<DwmWebhookDeliveryEvidenceOptions, 'auditEvents' | 'destinations' | 'filters' | 'liveDeliveryEnabled'> & {
    context: DwmWebhookDeliveryProjectionContext
}) {
    const { projection, now } = context
    const { evidence, deliveriesById } = projection
    const auditByDeliveryId = new Map(auditEvents.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
    const attemptsByIdempotencyKey = new Map<string, typeof evidence>()
    for (const item of evidence) {
        const key = clean(item.idempotencyKey)
        if (!key) continue
        const attempts = attemptsByIdempotencyKey.get(key) || []
        attempts.push(item)
        attemptsByIdempotencyKey.set(key, attempts)
    }
    const rows = evidence.map((item) => {
        const delivery = deliveriesById.get(item.deliveryId) || null
        const audit = auditByDeliveryId.get(item.deliveryId) || null
        const destination = item.destinationId ? destinationById.get(item.destinationId) || null : null
        const idempotencyKey = clean(item.idempotencyKey)
        const idempotencyAttempts = [...(idempotencyKey ? attemptsByIdempotencyKey.get(idempotencyKey) || [] : [])]
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const deliveredAttempt = idempotencyAttempts.find(attempt => attempt.status === 'delivered' && !attempt.dryRun) || null
        const duplicateAttemptCount = idempotencyAttempts.length > 1 ? idempotencyAttempts.length : 0
        const retryPlan = planDwmWebhookDeliveryRetry({
            status: delivery?.status || item.status,
            dryRun: delivery?.dryRun ?? item.dryRun,
            responseStatus: delivery?.responseStatus ?? item.response.httpStatus,
            error: delivery?.error || item.error,
            attemptedAt: delivery?.attemptedAt || item.attemptedAt,
            attemptCount: delivery?.attemptCount || 1,
            now,
        })
        const replayBody = delivery ? {
            orgId: delivery.orgId,
            destinationId: delivery.destinationId,
            alertId: delivery.alertId,
            watchlistItemId: delivery.watchlistId,
            watchlistId: delivery.watchlistId,
            watchlistName: delivery.watchlistName,
            dedupeKey: dedupeFromIdempotencyKey(delivery.idempotencyKey) || delivery.idempotencyKey,
            eventType: 'dwm.alert.replayed' as DwmAlertEventType,
            route: delivery.route,
            casePath: delivery.casePath,
            caseActionId: item.caseActionId,
            caseActionPath: item.caseActionPath,
            dryRun: true,
            live: false,
        } : null
        const retryReady = Boolean(retryPlan.nextRetryAt || item.dryRun || item.status === 'failed' || item.status === 'skipped')
        return {
            deliveryId: item.deliveryId,
            requestId: item.requestId,
            destinationId: item.destinationId,
            orgId: item.orgId,
            alertId: item.alertId,
            eventType: item.eventType,
            status: item.status,
            dryRun: item.dryRun,
            live: item.live,
            replay: item.replay,
            dedupeKey: item.dedupeKey,
            idempotencyKey: item.idempotencyKey,
            watchlistId: item.watchlistId,
            watchlistName: item.watchlistName,
            casePath: item.casePath,
            caseActionId: item.caseActionId,
            caseActionPath: item.caseActionPath,
            payloadHash: item.payloadHash,
            redactedDestination: {
                id: item.destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                endpointHint: item.redactedDestination.endpointHint,
                endpointHash: item.redactedDestination.endpointHash,
                endpointExposed: false,
            },
            sanitizedPayloadPreview: delivery?.payload ? buildDwmWebhookDestinationTestPayloadPreview(delivery.payload) : null,
            responseSummary: item.response.summary,
            error: item.error,
            retry: {
                attemptCount: delivery?.attemptCount || 1,
                retryable: retryReady,
                nextRetryAt: delivery?.nextRetryAt || retryPlan.nextRetryAt,
                errorClass: delivery?.errorClass || retryPlan.errorClass,
                reason: retryPlan.reason,
            },
            idempotency: {
                duplicate: duplicateAttemptCount > 0,
                duplicateAttemptCount,
                alreadyDelivered: Boolean(deliveredAttempt),
                deliveredDeliveryId: deliveredAttempt?.deliveryId || null,
                latestDeliveryId: idempotencyAttempts[0]?.deliveryId || null,
                deliveryIds: idempotencyAttempts.map(attempt => attempt.deliveryId).slice(0, 5),
            },
            replayHistory: {
                replay: item.replay,
                replayAttemptCount: idempotencyAttempts.filter(attempt => attempt.replay).length,
                dryRunAttemptCount: idempotencyAttempts.filter(attempt => attempt.dryRun).length,
                liveAttemptCount: idempotencyAttempts.filter(attempt => attempt.live).length,
                duplicateReplay: item.replay && duplicateAttemptCount > 0,
                duplicateLiveBlocked: Boolean(deliveredAttempt && item.status === 'skipped'),
            },
            audit: {
                auditEventId: item.auditEventId || audit?.id || null,
                action: item.auditAction || audit?.action || null,
            },
            timestamps: {
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                attemptedAt: item.attemptedAt,
            },
            actionRequests: {
                deliveryHistory: {
                    route: 'GET /api/dwm/webhook-deliveries',
                    query: {
                        orgId: item.orgId,
                        destinationId: item.destinationId,
                        alertId: item.alertId,
                        watchlistId: item.watchlistId,
                        casePath: item.casePath,
                        caseActionId: item.caseActionId,
                        caseActionPath: item.caseActionPath,
                        dedupeKey: item.dedupeKey,
                        deliveryId: item.deliveryId,
                    },
                },
                dryRunReplay: {
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: retryReady,
                    noNetwork: true,
                    body: replayBody,
                    expectedStatus: 'dry_run',
                    expectedAuditAction: 'delivery.replayed',
                },
                liveReplay: {
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: liveDeliveryEnabled && retryReady,
                    noNetwork: !liveDeliveryEnabled,
                    body: replayBody ? { ...replayBody, dryRun: false, live: true } : null,
                    blockers: liveDeliveryEnabled ? [] : [{
                        code: 'live_delivery_disabled',
                        message: 'Live webhook delivery is disabled for this environment.',
                        blocking: true,
                    }],
                },
            },
            operationLinks: delivery ? buildDwmWebhookDeliveryOperationLinks(delivery) : null,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_persistence_read.v1',
        noNetwork: true,
        externalSendEnabled: liveDeliveryEnabled,
        filters,
        total: rows.length,
        counts: {
            dryRun: rows.filter(row => row.dryRun).length,
            live: rows.filter(row => row.live).length,
            replay: rows.filter(row => row.replay).length,
            retryable: rows.filter(row => row.retry.retryable).length,
            auditLinked: rows.filter(row => row.audit.auditEventId).length,
            duplicateIdempotencyKeys: rows.filter(row => row.idempotency.duplicate).length,
            duplicateReplayRows: rows.filter(row => row.replayHistory.duplicateReplay).length,
        },
        rows,
        blockers: rows.length
            ? []
            : [{
                code: 'no_delivery_attempts',
                message: 'No persisted webhook delivery attempts matched the current filters.',
                blocking: false,
            }],
    }
}
