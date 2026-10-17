import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { dedupeFromIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { type DwmWebhookDestinationDeliveryAccessOptions } from './webhook-contract-types.ts'
import { buildDwmWebhookDeliveryRetryQueue } from './delivery-retry-queue.ts'
import { retryQueueBlocker } from './retry-queue-blocker.ts'

export function buildDwmWebhookDeliveryRetryRequestContract({
    destinations,
    deliveries = [],
    auditEvents = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationDeliveryAccessOptions) {
    const retryQueue = buildDwmWebhookDeliveryRetryQueue({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const entries = retryQueue.entries.map((entry) => {
        const dedupeKey = entry.dedupe.latestDedupeKey || dedupeFromIdempotencyKey(entry.idempotencyKey) || entry.alertId
        const requestAlert = {
            id: entry.alertId,
            dedupeKey,
            casePath: entry.casePath,
            watchlist: {
                id: entry.watchlistId,
                name: entry.watchlistName,
            },
            delivery: {
                route: entry.route,
                replay: entry.replay,
                idempotencyKey: entry.idempotencyKey,
            },
        }
        const baseBody = {
            orgId: entry.orgId,
            organizationId: entry.orgId,
            destinationId: entry.destinationId,
            eventType: entry.eventType,
            alertId: entry.alertId,
            dedupeKey,
            route: entry.route,
            casePath: entry.casePath,
            watchlistItemId: entry.watchlistId,
            watchlistId: entry.watchlistId,
            watchlistName: entry.watchlistName,
            alert: requestAlert,
        }
        const dryRunBlockers = uniqueWebhookBlockers(entry.blockers.filter(blocker => blocker.blocking))
        const liveBlockers = uniqueWebhookBlockers(
            liveDeliveryEnabled
                ? entry.blockers.filter(blocker => blocker.blocking)
                : [
                    ...entry.blockers,
                    retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; retry request is dry-run only.', entry.destinationId, true),
                ]
        )
        const canDryRun = retryQueue.access.canRetry && entry.retry.dryRunReady
        const canLive = retryQueue.access.canRetry && entry.retry.liveReady

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_request_entry.v1',
            idempotencyKey: entry.idempotencyKey,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alertId,
            eventType: entry.eventType,
            requestId: entry.latestAttempt.requestId,
            deliveryId: entry.latestAttempt.deliveryId,
            casePath: entry.casePath,
            replay: entry.replay,
            status: entry.status,
            destination: entry.destination,
            retry: entry.retry,
            dedupe: entry.dedupe,
            audit: entry.audit,
            blockers: entry.blockers,
            canRetry: canDryRun,
            noNetwork: true,
            externalSendEnabled: canLive,
            routes: {
                dryRun: 'POST /api/dwm/webhook-deliveries',
                live: 'POST /api/dwm/webhook-deliveries',
            },
            dryRunRequest: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: false,
                canSend: canDryRun,
                blockers: canDryRun ? [] : dryRunBlockers,
                body: {
                    ...baseBody,
                    dryRun: true,
                    live: false,
                },
            },
            liveRequest: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: false,
                externalSendEnabled: canLive,
                canSend: canLive,
                blockers: canLive ? [] : liveBlockers,
                body: {
                    ...baseBody,
                    dryRun: false,
                    live: true,
                },
            },
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_request.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.externalSendEnabled),
        visibility: retryQueue.visibility,
        access: retryQueue.access,
        filters: retryQueue.filters,
        routes: {
            retry: 'POST /api/dwm/webhook-deliveries',
            deliveryList: 'GET /api/dwm/webhook-deliveries',
        },
        counts: {
            total: entries.length,
            dryRunReady: entries.filter(entry => entry.dryRunRequest.canSend).length,
            liveReady: entries.filter(entry => entry.liveRequest.canSend).length,
            blocked: entries.filter(entry => !entry.dryRunRequest.canSend).length,
            permissionDenied: retryQueue.blockers.some(blocker => blocker.code === 'permission_denied'),
        },
        blockers: retryQueue.blockers,
        entries,
    }
}
