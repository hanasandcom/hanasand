import { type buildDwmWebhookDestinationHealth } from './destination-health.ts'
import { type destinationLifecycleState } from './destination-lifecycle-state.ts'
import { hasTerminalDeliveryFailure } from './destination-health-attempt.ts'

export function destinationLifecycleReadinessReceipt({
    health,
    lifecycleState,
    canManage,
}: {
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    lifecycleState: ReturnType<typeof destinationLifecycleState>
    canManage: boolean
}) {
    const terminalFailure = hasTerminalDeliveryFailure(health.lastFailure)
    const blockingCodes = lifecycleState.blockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const nextAction = lifecycleState.requiredActions.dryRunTest
        ? 'dry_run_test'
        : lifecycleState.requiredActions.enableDestination
            ? 'enable_destination'
            : lifecycleState.requiredActions.updateDestination
                ? 'review_destination'
                : health.retry.retryable
                    ? 'retry_delivery'
                    : lifecycleState.liveDeliveryUnverified
                        ? 'deliver_live_alert'
                        : health.ready
                            ? 'ready'
                            : 'inspect_destination'
    const nextDeliveryState = !health.enabled
        ? 'disabled'
        : terminalFailure
            ? 'terminal_failure'
            : health.retry.retryable
                ? 'retry_scheduled'
                : lifecycleState.testRequired
                    ? 'test_required'
                    : lifecycleState.liveDeliveryUnverified
                        ? 'live_delivery_unverified'
                        : health.ready
                            ? 'ready'
                            : 'blocked'

    return {
        schemaVersion: 'dwm.webhook.destination_lifecycle_readiness_receipt.v1',
        orgId: health.orgId,
        destinationId: health.destinationId,
        status: {
            lifecycle: lifecycleState.primary,
            health: health.health,
            nextDeliveryState,
            readyForDryRun: health.enabled && lifecycleState.secretState === 'redacted',
            readyForLive: lifecycleState.liveVerified && health.liveDeliveryEnabled && blockingCodes.length === 0,
            liveDeliveryEnabled: health.liveDeliveryEnabled,
        },
        nextAction,
        routes: {
            test: lifecycleState.requiredActions.dryRunTest?.route || `POST /api/dwm/webhook-destinations/${health.destinationId}/test`,
            update: lifecycleState.requiredActions.updateDestination?.route || `PATCH /api/dwm/webhook-destinations/${health.destinationId}`,
            enable: lifecycleState.requiredActions.enableDestination?.route || `PATCH /api/dwm/webhook-destinations/${health.destinationId}`,
            history: `/api/dwm/webhook-deliveries?orgId=${encodeURIComponent(health.orgId)}&destinationId=${encodeURIComponent(health.destinationId)}`,
        },
        actionBodyPreview: {
            dryRunTest: lifecycleState.requiredActions.dryRunTest?.body || null,
            enableDestination: lifecycleState.requiredActions.enableDestination?.body || null,
            updateDestination: lifecycleState.requiredActions.updateDestination ? { destinationId: health.destinationId } : null,
        },
        deliveryProof: {
            requestId: health.latestAttempt?.requestId || null,
            deliveryId: health.latestAttempt?.deliveryId || null,
            alertId: health.latestAttempt?.alertId || null,
            casePath: health.latestAttempt?.casePath || null,
            dedupeKey: health.latestAttempt?.dedupeKey || null,
            idempotencyKey: health.latestAttempt?.idempotencyKey || null,
            replay: health.latestAttempt?.replay ?? null,
            status: health.latestAttempt?.status || null,
            responseStatus: health.latestAttempt?.responseStatus || null,
            errorClass: health.latestAttempt?.errorClass || health.retry.errorClass || null,
            auditEventId: health.latestAttempt?.auditEventId || health.latestAuditEventId || null,
            attemptedAt: health.latestAttempt?.attemptedAt || null,
        },
        retry: {
            retryable: health.retry.retryable,
            nextRetryAt: health.retry.nextRetryAt,
            attemptCount: health.retry.attemptCount,
            lastErrorCategory: health.retry.errorClass,
            terminalFailure,
        },
        organizationLifecycleSettingsConsumer: {
            schemaVersion: 'dwm.webhook.organization_lifecycle_settings_consumer.v1',
            consumesSchemaVersion: 'organization.lifecycle_settings_mutation_receipt.v1',
            route: `PUT /api/organizations/${encodeURIComponent(health.orgId)}/settings`,
            readRoute: `GET /api/organizations/${encodeURIComponent(health.orgId)}/alert-readiness`,
            noNetwork: true,
            organizationId: health.orgId,
            destinationId: health.destinationId,
            expectedLifecycleStatuses: ['active', 'archived', 'deleted'],
            expectedDownstreamFields: [
                'settingsMutationReceipt.downstreamReadiness.webhookDeliveryReady',
                'settingsMutationReceipt.destinationReadiness.deliveryBlockedByLifecycle',
                'settingsMutationReceipt.destinationReadiness.nonmemberDestinationEnumeration',
                'settingsMutationReceipt.noLeakFields',
            ],
            deliveryBlockers: {
                archived: 'org_archived',
                deleted: 'org_deleted',
                active: null,
            },
            destinationReadiness: {
                deliveryBlockedByLifecycle: false,
                nonmemberDestinationEnumeration: false,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
            mutationPreview: {
                archive: {
                    method: 'PUT',
                    body: { lifecycleStatus: 'archived' },
                    expectedWebhookDeliveryReady: false,
                    expectedBlocker: 'org_archived',
                },
                reactivate: {
                    method: 'PUT',
                    body: { lifecycleStatus: 'active' },
                    expectedWebhookDeliveryReady: true,
                    expectedBlocker: null,
                },
            },
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
        },
        audit: {
            latestAuditEventId: health.latestAuditEventId,
            auditEventIds: canManage ? health.auditEventIds : [],
            auditEventCount: health.auditEventIds.length,
            actorExposed: canManage,
        },
        redactedDestination: {
            label: health.label,
            type: health.type,
            endpointHint: health.redactedEndpoint.endpointHint,
            endpointHash: health.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        blockers: lifecycleState.blockers,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: canManage,
        },
        noNetwork: true,
    }
}
