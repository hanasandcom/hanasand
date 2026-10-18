import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { type DwmWebhookDeliveryEvidenceAccessOptions } from './webhook-contract-types.ts'
import { deliveryEvidenceAccessDefaults } from './delivery-evidence-defaults.ts'
import { buildDwmWebhookDeliveryTimeline } from './delivery-read-projections.ts'
import { buildDwmWebhookDeliveryRetryRequestContract } from './delivery-retry-request-contract.ts'
import { buildDwmWebhookDestinationTestContract } from './destination-test-contract.ts'
import { retryQueueBlocker } from './retry-queue-blocker.ts'
import { deliveryActionRemediation } from './delivery-action-remediation.ts'

export function buildDwmWebhookDeliveryActionPlan(options: DwmWebhookDeliveryEvidenceAccessOptions) {
    const { deliveries, auditEvents, destinations, filters, liveDeliveryEnabled, viewerRole, canManage, visibility } = deliveryEvidenceAccessDefaults(options)
    const timeline = buildDwmWebhookDeliveryTimeline({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const retryRequest = buildDwmWebhookDeliveryRetryRequestContract({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const retryByIdempotencyKey = new Map(retryRequest.entries.map(entry => [entry.idempotencyKey, entry]))
    const destinationTestsById = new Map(destinations.map(destination => [destination.id, buildDwmWebhookDestinationTestContract({ destination, deliveries, auditEvents, liveDeliveryEnabled, viewerRole, canManage })]))
    const actions = timeline.timelines.map((item) => {
        const latest = item.latestReceipt
        const retryEntry = latest.idempotencyKey ? retryByIdempotencyKey.get(latest.idempotencyKey) || null : null
        const destinationDisabled = latest.destinationId && latest.destination.status && latest.destination.status !== 'active'
        const destinationUnavailable = latest.destination.availability.code === 'destination_unavailable'
        const terminalFailure = item.retry.terminalFailure
        const retryable = item.retry.retryable && retryEntry?.dryRunRequest.canSend === true
        const liveRetryable = item.retry.retryable && retryEntry?.liveRequest.canSend === true
        const delivered = item.status === 'delivered'
        const primaryAction = !timeline.access.canManage
            ? 'review_status'
            : retryable
                ? 'retry_dry_run'
                : liveRetryable
                    ? 'retry_live'
                    : destinationDisabled
                        ? 'enable_destination'
                        : destinationUnavailable
                            ? 'configure_destination'
                            : terminalFailure
                                ? 'rotate_or_disable_destination'
                                : delivered
                                    ? 'monitor'
                                    : 'test_destination'
        const blockers = uniqueWebhookBlockers([
            ...item.blockers,
            ...(!timeline.access.canManage ? [retryQueueBlocker('permission_denied', 'Only organization owners, admins, and editors can act on webhook deliveries.', latest.destinationId, true)] : []),
        ])
        const dryRunRequest = retryEntry?.dryRunRequest || null
        const liveRequest = retryEntry?.liveRequest || null
        const testDestinationRequest = latest.destinationId
            ? {
                canSend: timeline.access.canManage && !destinationUnavailable,
                noNetwork: true,
                externalSendEnabled: false,
                route: `POST /api/dwm/webhook-destinations/${latest.destinationId}/test`,
                body: {
                    orgId: item.orgId,
                    destinationId: latest.destinationId,
                    eventType: 'dwm.alert.test' as DwmAlertEventType,
                    dryRun: true,
                    live: false,
                    alertId: item.alertId,
                    dedupeKey: item.dedupeKey,
                    casePath: item.casePath,
                },
                payloadPreview: destinationTestsById.get(latest.destinationId)?.dryRunPayloadPreview || null,
                blockers: blockers.filter(blocker => ['permission_denied', 'destination_unavailable'].includes(blocker.code)),
            }
            : null
        const remediation = deliveryActionRemediation({
            action: primaryAction,
            orgId: item.orgId,
            destinationId: latest.destinationId,
            deliveryId: latest.deliveryId,
            alertId: item.alertId,
            casePath: item.casePath,
            dedupeKey: item.dedupeKey,
            retryable: item.retry.retryable,
            terminalFailure,
            delivered,
            destinationUnavailable,
            destinationDisabled: Boolean(destinationDisabled),
            blockers,
            liveDeliveryEnabled,
        })

        return {
            schemaVersion: 'dwm.webhook.delivery_action.v1',
            action: primaryAction,
            orgId: item.orgId,
            alertId: item.alertId,
            destinationId: latest.destinationId,
            deliveryId: latest.deliveryId,
            requestId: latest.requestId,
            idempotencyKey: latest.idempotencyKey,
            dedupeKey: item.dedupeKey,
            casePath: item.casePath,
            alertUrl: item.alertUrl,
            watchlist: item.watchlist,
            status: item.status,
            destination: latest.destination,
            retry: item.retry,
            audit: {
                latestAuditEventId: item.latestAuditEventId,
                auditEventIds: item.auditEventIds,
                nextAction: primaryAction === 'retry_dry_run' || primaryAction === 'retry_live'
                    ? 'delivery.retry_requested'
                    : primaryAction === 'rotate_or_disable_destination'
                        ? 'destination.update_requested'
                        : primaryAction === 'enable_destination'
                            ? 'destination.enable_requested'
                            : primaryAction === 'test_destination'
                                ? 'delivery.test_requested'
                                : null,
            },
            routes: {
                deliveryList: 'GET /api/dwm/webhook-deliveries',
                retry: 'POST /api/dwm/webhook-deliveries',
                testDestination: latest.destinationId ? `POST /api/dwm/webhook-destinations/${latest.destinationId}/test` : null,
                updateDestination: latest.destinationId ? `PUT /api/dwm/webhook-destinations/${latest.destinationId}` : null,
            },
            operationLinks: latest.operationLinks,
            remediation,
            requests: {
                dryRunRetry: dryRunRequest
                    ? {
                        canSend: dryRunRequest.canSend,
                        noNetwork: true,
                        externalSendEnabled: false,
                        body: dryRunRequest.body,
                        blockers: dryRunRequest.blockers,
                    }
                    : null,
                liveRetry: liveRequest
                    ? {
                        canSend: liveRequest.canSend,
                        noNetwork: false,
                        externalSendEnabled: liveRequest.externalSendEnabled,
                        body: liveRequest.canSend ? liveRequest.body : null,
                        blockers: liveRequest.blockers,
                    }
                    : null,
                testDestination: testDestinationRequest,
            },
            blockers,
            blockingCodes: blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code),
            noNetwork: true,
            externalSendEnabled: liveRequest?.externalSendEnabled === true,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_action_plan.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: actions.some(action => action.externalSendEnabled),
        visibility: timeline.visibility,
        access: timeline.access,
        filters: timeline.filters,
        counts: {
            total: actions.length,
            retryDryRun: actions.filter(action => action.action === 'retry_dry_run').length,
            retryLive: actions.filter(action => action.action === 'retry_live').length,
            rotateOrDisable: actions.filter(action => action.action === 'rotate_or_disable_destination').length,
            enableDestination: actions.filter(action => action.action === 'enable_destination').length,
            monitor: actions.filter(action => action.action === 'monitor').length,
            blocked: actions.filter(action => action.blockingCodes.length > 0).length,
            permissionDenied: timeline.blockers.some(blocker => blocker.code === 'permission_denied'),
        },
        blockers: timeline.blockers,
        actions,
    }
}
