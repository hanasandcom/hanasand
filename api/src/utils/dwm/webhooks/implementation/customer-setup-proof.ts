import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { type DwmWebhookDestinationVisibilityOptions } from './webhook-contract-types.ts'
import { buildDwmWebhookDestinationReadModels } from './destination-admin-proof.ts'
import { webhookVisibilityDecision, webhookAccess } from './webhook-visibility-decision.ts'
import { retryQueueBlocker } from './retry-queue-blocker.ts'
import { webhookSetupRoutes } from './webhook-setup-routes.ts'
import { buildDwmWebhookDestinationTestContract } from './destination-test-contract.ts'
import { buildDwmWebhookDeliveryReplayGuard } from './delivery-replay-guard.ts'

export function buildDwmWebhookCustomerSetupProof({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
    readModels: suppliedReadModels,
}: DwmWebhookDestinationVisibilityOptions & {
    readModels?: ReturnType<typeof buildDwmWebhookDestinationReadModels>
}) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canCreate', 'canUpdate', 'canTest', 'canDelete', 'canDeliver'] as const)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.customer_setup.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            status: 'permission_denied',
            summary: {
                destinationCount: 0,
                activeDestinationCount: 0,
                verifiedDryRunCount: 0,
                recentOrgAlertDeliveryCount: 0,
                retryScheduledCount: 0,
                terminalFailureCount: 0,
            },
            blockers: [retryQueueBlocker('permission_denied', 'Webhook destination setup is not visible for this organization membership.', null, true)],
            routes: webhookSetupRoutes(),
            setupSteps: [],
        }
    }

    const readModels = suppliedReadModels || buildDwmWebhookDestinationReadModels({
        destinations, deliveries, auditEvents, liveDeliveryEnabled, viewerRole, canManage,
    })
    const { deliveryReadiness: readiness, destinationAdminProof: adminProof } = readModels
    const destinationTests = destinations.map(destination => buildDwmWebhookDestinationTestContract({
        destination,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    }))
    const replayGuard = buildDwmWebhookDeliveryReplayGuard({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const activeDestinations = readiness.destinations.filter(destination => destination.enabled)
    const verifiedTests = destinationTests.filter(test => test.status === 'verified')
    const recentOrgAlertDeliveries = readiness.recentAttempts.filter(attempt => attempt.eventType !== 'dwm.alert.test')
    const retryScheduled = readiness.destinations.filter(destination => destination.retryState.retryable)
    const terminalFailures = replayGuard.entries.filter(entry => entry.retry.terminalFailure)
    const firstActiveDestination = activeDestinations[0] || null
    const dryRunTestRequests = activeDestinations.map(destination => {
        const test = destinationTests.find(item => item.destinationId === destination.destinationId) || null
        return {
            method: 'POST',
            route: `POST /api/dwm/webhook-destinations/${destination.destinationId}/test`,
            noNetwork: true,
            externalSendEnabled: false,
            destinationId: destination.destinationId,
            orgId: destination.orgId,
            label: destination.label,
            enabled: destination.enabled,
            status: destination.status,
            body: {
                dryRun: true,
                live: false,
                eventType: 'dwm.alert.test',
                destinationId: destination.destinationId,
                orgId: destination.orgId,
            },
            payloadPreview: test?.dryRunPayloadPreview || null,
            blockers: test?.blockers || [],
        }
    })
    const blockers = []
    if (destinations.length === 0) blockers.push(retryQueueBlocker('missing_webhook_destination', 'Create a Discord or webhook destination before enabling customer alert delivery.', null, true))
    if (destinations.length > 0 && activeDestinations.length === 0) blockers.push(retryQueueBlocker('no_active_destination', 'All webhook destinations are disabled.', null, true))
    if (activeDestinations.length > 0 && verifiedTests.length === 0) blockers.push(retryQueueBlocker('no_verified_dry_run', 'Run a dry-run destination test before relying on customer notifications.', firstActiveDestination?.destinationId || null, true))
    if (recentOrgAlertDeliveries.length === 0) blockers.push(retryQueueBlocker('no_recent_org_alert_delivery', 'No org alert delivery attempt has been recorded yet.', firstActiveDestination?.destinationId || null, false))
    if (retryScheduled.length > 0) blockers.push(retryQueueBlocker('retry_scheduled', 'One or more destinations have retryable failed deliveries.', retryScheduled[0]?.destinationId || null, false))
    if (terminalFailures.length > 0) blockers.push(retryQueueBlocker('terminal_failure', 'One or more destinations have terminal delivery failures that need remediation.', terminalFailures[0]?.destinationId || null, true))
    if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled; setup can still be verified with dry-run tests.', firstActiveDestination?.destinationId || null, false))
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const status = blockingCodes.length > 0
        ? destinations.length === 0
            ? 'missing_destination'
            : 'blocked'
        : verifiedTests.length > 0
            ? 'verified'
            : 'needs_test'

    return {
        schemaVersion: 'dwm.webhook.customer_setup.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: liveDeliveryEnabled && blockingCodes.length === 0,
        visibility: decision,
        access,
        status,
        summary: {
            destinationCount: destinations.length,
            activeDestinationCount: activeDestinations.length,
            verifiedDryRunCount: verifiedTests.length,
            recentOrgAlertDeliveryCount: recentOrgAlertDeliveries.length,
            retryScheduledCount: retryScheduled.length,
            terminalFailureCount: terminalFailures.length,
        },
        routes: webhookSetupRoutes(firstActiveDestination?.destinationId || '<destination_id>'),
        blockers: uniqueBlockers,
        blockerCodes: blockingCodes,
        setupSteps: [
            {
                id: 'create_destination',
                label: 'Create destination',
                status: destinations.length > 0 ? 'complete' : access.canCreate ? 'available' : 'blocked',
                route: 'POST /api/dwm/webhooks',
                blockers: destinations.length > 0 ? [] : uniqueBlockers.filter(blocker => blocker.code === 'permission_denied'),
            },
            {
                id: 'dry_run_test',
                label: 'Run dry-run test',
                status: verifiedTests.length > 0 ? 'complete' : activeDestinations.length > 0 && access.canTest ? 'available' : 'blocked',
                route: firstActiveDestination ? `POST /api/dwm/webhook-destinations/${firstActiveDestination.destinationId}/test` : 'POST /api/dwm/webhook-destinations/:id/test',
                noNetwork: true,
                externalSendEnabled: false,
                blockers: uniqueBlockers.filter(blocker => ['no_active_destination', 'missing_webhook_destination', 'permission_denied'].includes(blocker.code)),
            },
            {
                id: 'deliver_org_alert',
                label: 'Deliver org alert',
                status: recentOrgAlertDeliveries.length > 0 ? 'complete' : blockingCodes.length === 0 && access.canDeliver ? 'available' : 'blocked',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: liveDeliveryEnabled && blockingCodes.length === 0,
                blockers: uniqueBlockers,
            },
        ],
        dryRunTestRequest: dryRunTestRequests[0] || null,
        dryRunTestRequests,
        deliveryReadiness: readiness,
        destinationTests,
        destinationAdminProof: adminProof,
        deliveryReplayGuard: replayGuard,
    }
}
