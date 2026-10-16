import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'

export function supportWebhookDestinationReadiness(input: {
    organizationId: string
    requestId: string
    reason: string
    supportContext: string
    destinations: Array<Record<string, any>>
}) {
    const active = input.destinations.filter(destination => destination.status === 'active')
    const paused = input.destinations.filter(destination => destination.status === 'paused')
    const failedTests = input.destinations.filter(destination => destination.lastTestStatus === 'failed' || destination.lastTestErrorPresent)
    const destinationIds = input.destinations.map(destination => text(destination.id)).filter(Boolean)
    const deliveredDestinations = input.destinations.filter(destination => Boolean(destination.lastDeliveryAt))
    const latestDeliveryAt = uniqueTimelineValues(deliveredDestinations.map(destination => destination.lastDeliveryAt))[0] || null
    const deliveryHistoryLinks = destinationIds.map(destinationId => `/api/dwm/webhook-deliveries?orgId=${encodeURIComponent(input.organizationId)}&destinationId=${encodeURIComponent(destinationId)}`)
    return {
        schemaVersion: 'support.organization.webhook_destination_readiness.v1',
        generatedAt: new Date().toISOString(),
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason || null,
        supportContextPresent: Boolean(input.supportContext),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        destinationCount: input.destinations.length,
        activeCount: active.length,
        pausedCount: paused.length,
        failedTestCount: failedTests.length,
        destinationIds,
        deliveryHistoryDiagnostic: {
            schemaVersion: 'support.webhook_delivery.history_diagnostic.v1',
            generatedAt: new Date().toISOString(),
            organizationId: input.organizationId,
            requestId: input.requestId,
            sourceWorkflow: 'webhook',
            redacted: true,
            noMutation: true,
            supportRoleRequired: true,
            expectedConsumer: 'case.replay',
            deliveryObservedCount: deliveredDestinations.length,
            latestDeliveryAt,
            destinationIds,
            deliveryHistoryLinks,
            auditFilters: {
                current: auditFilterQuery({ org: input.organizationId, workflow: 'webhook', action: 'webhook', request: input.requestId, source: 'admin', service: 'hanasand-api' }),
                byDestination: destinationIds.map(entity => auditFilterQuery({ org: input.organizationId, workflow: 'webhook', entity, action: 'webhook', source: 'admin', service: 'hanasand-api' })),
                failed: auditFilterQuery({ org: input.organizationId, workflow: 'webhook', action: 'webhook', outcome: 'failed', source: 'admin', service: 'hanasand-api' }),
                denied: auditFilterQuery({ org: input.organizationId, workflow: 'webhook', action: 'webhook', outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            },
            blockers: uniqueTimelineValues([
                destinationIds.length ? '' : 'missing_webhook_destination',
                deliveredDestinations.length ? '' : 'missing_webhook_delivery_history',
                failedTests.length ? 'webhook_destination_test_failed' : '',
            ]),
            forbiddenFields: ['endpoint_encrypted', 'endpointUrl', 'webhookUrl', 'secret', 'token', 'authorization', 'cookie'],
            safeHandoff: {
                noLiveWebhookDelivery: true,
                noSecretExposure: true,
                noCrossOrgLeakage: true,
                redactionRequired: true,
            },
        },
        audit: {
            current: auditFilterQuery({ org: input.organizationId, action: 'webhook', request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            byDestination: destinationIds.map(entity => auditFilterQuery({ org: input.organizationId, entity, action: 'webhook', source: 'admin', service: 'hanasand-api' })),
            denied: auditFilterQuery({ org: input.organizationId, action: 'webhook', outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            failed: auditFilterQuery({ org: input.organizationId, action: 'webhook', outcome: 'failed', source: 'admin', service: 'hanasand-api' }),
        },
        caseReadiness: {
            schemaVersion: 'support.webhook_destination.case_readiness.v1',
            expectedConsumer: 'case.replay',
            organizationId: input.organizationId,
            blockers: uniqueTimelineValues([
                input.destinations.length ? '' : 'missing_webhook_destination',
                failedTests.length ? 'webhook_destination_test_failed' : '',
            ]),
            noLiveDelivery: true,
            noSecretExposure: true,
        },
        forbiddenFields: ['endpoint_encrypted', 'endpointUrl', 'webhookUrl', 'secret', 'token', 'authorization'],
        denialCases: [
            'support_role_required',
            'wrong_org_scope',
            'webhook_destination_not_found',
            'webhook_destination_test_failed',
            'redaction_required',
        ],
    }
}
