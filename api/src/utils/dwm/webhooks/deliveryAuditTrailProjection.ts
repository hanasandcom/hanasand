import type { buildDwmWebhookDeliveryRetryWorkOrders } from '../webhooks.ts'
import type { normalizeWebhookEvidenceFilters } from '../webhookDeliveryEvidence.ts'
import type { buildDwmWebhookAuditEventContracts } from '../webhookAuditContracts.ts'
import type { DwmAlertEventType } from '../webhookDestinationTypes.ts'
import { buildIdempotencyKey, dedupeFromIdempotencyKey, truncate } from '../webhookDeliveryUtilities.ts'
import { makeWebhookBlocker } from '../webhookValueUtils.ts'

type AuditContracts = ReturnType<typeof buildDwmWebhookAuditEventContracts>
type RetryWorkOrders = ReturnType<typeof buildDwmWebhookDeliveryRetryWorkOrders>
type Filters = ReturnType<typeof normalizeWebhookEvidenceFilters>

export function buildDwmWebhookDeliveryAuditTrailProjection({
    auditContracts,
    retryWorkOrders,
    filters,
    liveDeliveryEnabled,
    decision,
    access,
}: {
    auditContracts: AuditContracts
    retryWorkOrders: RetryWorkOrders
    filters: Filters
    liveDeliveryEnabled: boolean
    decision: unknown
    access: { canManage: boolean; memberSafe: boolean }
}) {
    const retryByDeliveryId = new Map(retryWorkOrders.workOrders.map(order => [order.deliveryId, order]))
    const entries = auditContracts
        .filter((audit) => {
            if (filters.orgId && audit.orgId !== filters.orgId) return false
            if (filters.destinationId && audit.destinationId !== filters.destinationId) return false
            if (filters.requestId && audit.deliveryId !== filters.requestId && audit.requestId !== filters.requestId) return false
            if (filters.alertId && audit.delivery?.alertId !== filters.alertId) return false
            if (filters.casePath && audit.delivery?.casePath !== filters.casePath) return false
            if (filters.dedupeKey) {
                const deliveryDedupeKey = audit.delivery?.idempotencyKey
                    ? dedupeFromIdempotencyKey(audit.delivery.idempotencyKey)
                    : null
                if (audit.delivery?.idempotencyKey !== filters.dedupeKey && deliveryDedupeKey !== filters.dedupeKey) return false
            }
            return true
        })
        .map((audit) => {
            const retryWorkOrder = audit.deliveryId ? retryByDeliveryId.get(audit.deliveryId) || null : null
            const replay = audit.delivery?.eventType === 'dwm.alert.replayed' || audit.action === 'delivery.replayed'
            const summary = audit.category === 'destination'
                ? `${audit.outcome} destination ${audit.destination?.label || audit.destinationId || 'webhook destination'}`
                : `${audit.outcome} ${audit.delivery?.eventType || 'webhook delivery'} for alert ${audit.delivery?.alertId || 'unknown'}`
            const retryActionRequest = retryWorkOrder
                ? {
                    action: retryWorkOrder.state === 'dry_run_ready' || retryWorkOrder.state === 'live_ready'
                        ? 'retry_delivery'
                        : retryWorkOrder.state === 'already_delivered'
                            ? 'review_duplicate'
                            : retryWorkOrder.state === 'terminal_failure'
                                ? 'remediate_destination'
                                : 'review_blocker',
                    method: 'POST',
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: access.canManage && retryWorkOrder.eligibility.dryRunReady,
                    noNetwork: true,
                    externalSendEnabled: false,
                    body: access.canManage && retryWorkOrder.eligibility.dryRunReady
                        ? retryWorkOrder.request.dryRunBody
                        : null,
                    expectedAuditAction: retryWorkOrder.audit.nextAction,
                    expectedStatus: retryWorkOrder.eligibility.dryRunReady ? 'dry_run' : 'blocked',
                    blockers: retryWorkOrder.eligibility.blockers,
                }
                : null
            const destinationTestRequest = !retryActionRequest && audit.destinationId
                ? {
                    action: 'test_destination',
                    method: 'POST',
                    route: `POST /api/dwm/webhook-destinations/${audit.destinationId}/test`,
                    canSend: access.canManage && audit.destination?.enabled === true,
                    noNetwork: true,
                    externalSendEnabled: false,
                    body: access.canManage && audit.destination?.enabled === true
                        ? {
                            orgId: audit.orgId,
                            destinationId: audit.destinationId,
                            eventType: 'dwm.alert.test' as DwmAlertEventType,
                            dryRun: true,
                            live: false,
                            idempotencyKey: buildIdempotencyKey('dwm.alert.test', audit.orgId, audit.destinationId, 'webhook_test'),
                        }
                        : null,
                    expectedAuditAction: 'delivery.tested',
                    expectedStatus: access.canManage && audit.destination?.enabled === true ? 'dry_run' : 'blocked',
                    blockers: audit.destination?.enabled === true
                        ? []
                        : [makeWebhookBlocker('destination_disabled', 'Destination is disabled and cannot be tested.', audit.destinationId, true)],
                }
                : null

            return {
                schemaVersion: 'dwm.webhook.audit_trail_entry.v1',
                auditEventId: audit.auditEventId,
                action: audit.action,
                category: audit.category,
                outcome: audit.outcome,
                severity: audit.severity,
                orgId: audit.orgId,
                destinationId: audit.destinationId,
                deliveryId: audit.deliveryId,
                requestId: audit.requestId,
                actorId: access.canManage ? audit.actorId : null,
                customerSummary: truncate(summary, 180),
                destination: audit.destination,
                delivery: audit.delivery
                    ? {
                        alertId: audit.delivery.alertId,
                        eventType: audit.delivery.eventType,
                        status: audit.delivery.status,
                        dryRun: audit.delivery.dryRun,
                        live: audit.delivery.live,
                        replay,
                        idempotencyKey: audit.delivery.idempotencyKey,
                        dedupeKey: audit.delivery.idempotencyKey ? dedupeFromIdempotencyKey(audit.delivery.idempotencyKey) : null,
                        payloadHash: audit.delivery.payloadHash,
                        responseStatus: audit.delivery.responseStatus,
                        error: audit.delivery.error,
                        watchlistId: audit.delivery.watchlistId,
                        watchlistName: audit.delivery.watchlistName,
                        route: audit.delivery.route,
                        casePath: audit.delivery.casePath,
                        attemptedAt: audit.delivery.attemptedAt,
                        updatedAt: audit.delivery.updatedAt,
                    }
                    : null,
                retry: retryWorkOrder
                    ? {
                        state: retryWorkOrder.state,
                        nextRetryAt: retryWorkOrder.eligibility.nextRetryAt,
                        attemptCount: retryWorkOrder.eligibility.attemptCount,
                        lastErrorCategory: retryWorkOrder.eligibility.lastErrorCategory,
                        canRetry: access.canManage && retryWorkOrder.eligibility.canRetry,
                        nextAuditAction: retryWorkOrder.audit.nextAction,
                    }
                    : audit.retry,
                metadata: access.canManage ? audit.metadata : null,
                actionRequest: retryActionRequest || destinationTestRequest,
                routes: {
                    delivery: audit.deliveryId ? `GET /api/dwm/webhook-deliveries?deliveryId=${audit.deliveryId}` : null,
                    destination: audit.destinationId ? `GET /api/dwm/webhooks?destinationId=${audit.destinationId}` : null,
                    retry: retryWorkOrder ? 'POST /api/dwm/webhook-deliveries' : null,
                    testDestination: audit.destinationId ? `POST /api/dwm/webhook-destinations/${audit.destinationId}/test` : null,
                },
                memberSafe: access.memberSafe,
                createdAt: audit.createdAt,
            }
        })

    return {
        schemaVersion: 'dwm.webhook.audit_trail.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        visibility: decision,
        access,
        filters,
        counts: {
            total: entries.length,
            destination: entries.filter(entry => entry.category === 'destination').length,
            delivery: entries.filter(entry => entry.category === 'delivery').length,
            failed: entries.filter(entry => entry.outcome === 'failed').length,
            retryable: entries.filter(entry => Boolean(entry.retry?.nextRetryAt)).length,
            replay: entries.filter(entry => entry.delivery?.replay).length,
            memberSafe: entries.filter(entry => entry.memberSafe).length,
        },
        blockers: [],
        entries,
    }
}
