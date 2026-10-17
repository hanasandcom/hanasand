import { type retryQueueBlocker } from './retry-queue-blocker.ts'

export function deliveryActionRemediation({
    action,
    orgId,
    destinationId,
    deliveryId,
    alertId,
    casePath,
    dedupeKey,
    retryable,
    terminalFailure,
    delivered,
    destinationUnavailable,
    destinationDisabled,
    blockers,
    liveDeliveryEnabled,
}: {
    action: string
    orgId: string
    destinationId: string | null
    deliveryId: string | null
    alertId: string | null
    casePath: string | null
    dedupeKey: string | null
    retryable: boolean
    terminalFailure: boolean
    delivered: boolean
    destinationUnavailable: boolean
    destinationDisabled: boolean
    blockers: ReturnType<typeof retryQueueBlocker>[]
    liveDeliveryEnabled: boolean
}) {
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const code = blockingCodes.includes('permission_denied')
        ? 'permission_denied'
        : destinationUnavailable
            ? 'configure_destination'
            : destinationDisabled
                ? 'enable_destination'
                : terminalFailure
                    ? 'rotate_or_disable_destination'
                    : retryable
                        ? 'retry_dry_run'
                        : delivered
                            ? 'monitor_delivery'
                            : 'test_destination'
    const nextSafeStep = code === 'retry_dry_run'
        ? 'Run a dry-run retry and inspect the recorded delivery receipt before enabling live delivery.'
        : code === 'configure_destination'
            ? 'Create or select an enabled org webhook destination, then run a dry-run test.'
            : code === 'enable_destination'
                ? 'Enable the destination and run a dry-run test before replaying alert delivery.'
                : code === 'rotate_or_disable_destination'
                    ? 'Rotate the webhook URL or disable the destination, then run a dry-run test to clear the terminal failure.'
                    : code === 'permission_denied'
                        ? 'Ask an organization owner or admin to review the destination and delivery history.'
                        : code === 'monitor_delivery'
                            ? 'No resend is needed; keep the delivery receipt and audit event for inspection.'
                            : 'Run a destination dry-run test to verify the Discord payload and destination health.'

    return {
        schemaVersion: 'dwm.webhook.delivery_remediation.v1',
        code,
        action,
        status: delivered ? 'resolved' : blockingCodes.length > 0 ? 'blocked' : 'ready',
        priority: terminalFailure || destinationUnavailable || destinationDisabled ? 'high' : retryable ? 'normal' : 'low',
        nextSafeStep,
        liveDeliveryEnabled,
        noNetworkDefault: true,
        externalSendEnabled: false,
        context: {
            orgId,
            destinationId,
            deliveryId,
            alertId,
            casePath,
            dedupeKey,
        },
        blockers: blockers.map(blocker => ({
            code: blocker.code,
            destinationId: blocker.destinationId,
            blocking: blocker.blocking,
        })),
        routeHints: {
            deliveryHistory: 'GET /api/dwm/webhook-deliveries',
            destinationTest: destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : null,
            destinationUpdate: destinationId ? `PUT /api/dwm/webhook-destinations/${destinationId}` : null,
            dryRunReplay: 'POST /api/dwm/webhook-deliveries',
        },
        readiness: {
            dryRunReplayReady: code === 'retry_dry_run',
            liveReplayBlocked: !liveDeliveryEnabled,
            terminalFailure,
            destinationUnavailable,
            destinationDisabled,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            payloadSecretExposed: false,
        },
    }
}
