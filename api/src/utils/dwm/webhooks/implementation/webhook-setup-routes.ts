import { makeWebhookBlockerWithFields, uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { type destinationLifecycleState } from './destination-lifecycle-state.ts'
import { type buildDwmWebhookDestinationHealth } from './destination-health.ts'
import { hasTerminalDeliveryFailure } from './destination-health-attempt.ts'
import { isLiveDeliveredProof } from './webhook-contract-types.ts'

export function webhookSetupRoutes(destinationId = '<destination_id>') {
    return {
        list: 'GET /api/dwm/webhooks?orgId=<org_id>',
        create: 'POST /api/dwm/webhooks',
        update: `PUT /api/dwm/webhook-destinations/${destinationId}`,
        disable: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        delete: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        archive: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        test: `POST /api/dwm/webhook-destinations/${destinationId}/test`,
        deliver: 'POST /api/dwm/webhook-deliveries',
        deliveryHistory: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
    }
}

export function dashboardReadinessBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    reason: string | null = null,
    blocking = true
) {
    return makeWebhookBlockerWithFields(code, message, destinationId, { reason, blocking })
}

export const uniqueDashboardReadinessBlockers = (blockers: ReturnType<typeof dashboardReadinessBlocker>[]) => uniqueWebhookBlockers(blockers, true)

export function dashboardPrimaryHealthStatus(states: string[]) {
    const priority = [
        'policy_blocked',
        'disabled',
        'secret_missing',
        'test_failed',
        'terminal_failure',
        'retry_scheduled',
        'verified',
    ]
    for (const status of priority) {
        if (states.includes(status)) return status
    }
    return 'unverified'
}

export function dashboardLifecycleActionSummary(rows: Array<{
    destinationId: string
    lifecycleState: ReturnType<typeof destinationLifecycleState>
}>) {
    const dryRunRows = rows.filter(row => row.lifecycleState.requiredActions.dryRunTest)
    const enableRows = rows.filter(row => row.lifecycleState.requiredActions.enableDestination)
    const updateRows = rows.filter(row => row.lifecycleState.requiredActions.updateDestination)
    const ownerReviewRows = rows.filter(row => row.lifecycleState.revokedOwner)
    const actions = [
        dryRunRows.length
            ? {
                action: 'dry_run_test',
                count: dryRunRows.length,
                destinationIds: dryRunRows.map(row => row.destinationId),
                routeTemplate: 'POST /api/dwm/webhook-destinations/{destinationId}/test',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        enableRows.length
            ? {
                action: 'enable_destination',
                count: enableRows.length,
                destinationIds: enableRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                bodyPreview: { status: 'active' },
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        updateRows.length
            ? {
                action: 'review_destination_owner_or_secret',
                count: updateRows.length,
                destinationIds: updateRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        ownerReviewRows.length
            ? {
                action: 'review_revoked_owner',
                count: ownerReviewRows.length,
                destinationIds: ownerReviewRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
    ].filter(Boolean) as Array<Record<string, unknown>>

    return actions.map(action => ({
        ...action,
        redaction: {
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: false,
            safeForCustomerDisplay: true,
        },
    }))
}

export function destinationHealthStates(health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]) {
    const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
    const terminalFailure = hasTerminalDeliveryFailure(health.lastFailure)
    const states = [
        !health.enabled ? 'disabled' : null,
        endpointPresent ? null : 'secret_missing',
        health.lastTest.status === 'failed' ? 'test_failed' : null,
        health.retry.retryable ? 'retry_scheduled' : null,
        terminalFailure ? 'terminal_failure' : null,
        health.enabled && endpointPresent && health.lastTest.requestId && isLiveDeliveredProof(health.lastTest) ? 'verified' : null,
    ].filter(Boolean) as string[]
    return [...new Set(states.length ? states : ['unverified'])]
}
