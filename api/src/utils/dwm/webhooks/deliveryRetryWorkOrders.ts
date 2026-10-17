import type { buildDwmWebhookDeliveryRetryRequestContract } from './implementation/delivery-retry-request-contract.ts'
import { dedupeFromIdempotencyKey } from '../webhookDeliveryUtilities.ts'

type RetryRequest = ReturnType<typeof buildDwmWebhookDeliveryRetryRequestContract>

export function buildDwmWebhookDeliveryRetryWorkOrdersProjection(
    retryRequest: RetryRequest,
    liveDeliveryEnabled: boolean,
) {
    const workOrders = retryRequest.entries.map((entry) => {
        const blockingCodes = entry.blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
        const state = entry.liveRequest.canSend
            ? 'live_ready'
            : entry.dryRunRequest.canSend
                ? 'dry_run_ready'
                : entry.dedupe.alreadyDelivered
                    ? 'already_delivered'
                    : entry.retry.terminalFailure
                        ? 'terminal_failure'
                        : blockingCodes.includes('permission_denied')
                            ? 'permission_denied'
                            : 'blocked'
        const nextAuditAction = state === 'dry_run_ready' || state === 'live_ready'
            ? 'delivery.retry_requested'
            : state === 'already_delivered'
                ? 'delivery.retry_skipped_duplicate'
                : state === 'terminal_failure'
                    ? 'delivery.retry_terminal_failure'
                    : 'delivery.retry_blocked'

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_work_order.v1',
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alertId,
            eventType: entry.eventType,
            requestId: entry.requestId,
            deliveryId: entry.deliveryId,
            idempotencyKey: entry.idempotencyKey,
            dedupeKey: entry.dedupe.latestDedupeKey || dedupeFromIdempotencyKey(entry.idempotencyKey) || null,
            casePath: entry.casePath,
            replay: entry.replay,
            state,
            destination: entry.destination,
            eligibility: {
                canRetry: entry.canRetry,
                dryRunReady: entry.dryRunRequest.canSend,
                liveReady: entry.liveRequest.canSend,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: entry.retry.persistedAttemptCount,
                terminalFailure: entry.retry.terminalFailure,
                lastErrorCategory: entry.retry.lastErrorCategory,
                blockers: entry.blockers,
            },
            request: {
                route: entry.routes.dryRun,
                dryRunBody: entry.dryRunRequest.body,
                liveBody: entry.liveRequest.canSend ? entry.liveRequest.body : null,
                noNetwork: true,
                externalSendEnabled: entry.liveRequest.canSend,
            },
            audit: {
                latestAuditEventId: entry.audit.latestAuditEventId,
                auditEventIds: entry.audit.auditEventIds,
                nextAction: nextAuditAction,
                requiredMetadata: [
                    'orgId',
                    'destinationId',
                    'deliveryId',
                    'idempotencyKey',
                    'dedupeKey',
                    'status',
                    'dryRun',
                    'live',
                ],
            },
            worker3Proof: {
                route: 'POST /api/dwm/webhook-deliveries',
                expectedDryRunStatus: entry.dryRunRequest.canSend ? 'dry_run' : 'blocked',
                expectedLiveStatus: entry.liveRequest.canSend ? 'delivered_or_failed' : 'blocked',
                noNetworkDefault: true,
                liveRequiresConfig: !liveDeliveryEnabled,
            },
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_work_orders.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: workOrders.some(order => order.request.externalSendEnabled),
        visibility: retryRequest.visibility,
        access: retryRequest.access,
        filters: retryRequest.filters,
        counts: {
            total: workOrders.length,
            dryRunReady: workOrders.filter(order => order.state === 'dry_run_ready').length,
            liveReady: workOrders.filter(order => order.state === 'live_ready').length,
            blocked: workOrders.filter(order => order.state === 'blocked' || order.state === 'permission_denied').length,
            alreadyDelivered: workOrders.filter(order => order.state === 'already_delivered').length,
            terminalFailure: workOrders.filter(order => order.state === 'terminal_failure').length,
            auditLinked: workOrders.filter(order => Boolean(order.audit.latestAuditEventId)).length,
        },
        blockers: retryRequest.blockers,
        workOrders,
    }
}
