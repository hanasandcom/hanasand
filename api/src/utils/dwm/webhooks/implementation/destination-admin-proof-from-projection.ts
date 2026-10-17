import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { buildDwmWebhookDeliveryOperationsFromProjection } from '../../webhookDeliveryOperations.ts'
import { type DwmWebhookDestinationVisibilityOptions } from './webhook-contract-types.ts'
import { type DwmWebhookDestinationProjection, prepareDwmWebhookDestinationProjection, buildDwmWebhookDestinationHealthFromProjection } from './dwm-webhook-destination-projection.ts'
import { type buildDwmWebhookDestinationHealth } from './destination-health.ts'
import { type buildDwmWebhookDestinationLifecycle, buildDwmWebhookDestinationLifecycleFromProjection } from './destination-lifecycle-from-projection.ts'
import { webhookVisibilityDecision, webhookAccess } from './webhook-visibility-decision.ts'
import { adminProofBlocker, webhookProductProgressSummary, destinationAdminProofSummary, destinationAdminProofBlockers } from './admin-proof-blocker.ts'

export function buildDwmWebhookDestinationAdminProofFromProjection({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
    projection,
    healthRows: preparedHealthRows,
    lifecycleRows: preparedLifecycleRows,
}: DwmWebhookDestinationVisibilityOptions & {
    projection?: DwmWebhookDestinationProjection
    healthRows?: ReturnType<typeof buildDwmWebhookDestinationHealth>
    lifecycleRows?: ReturnType<typeof buildDwmWebhookDestinationLifecycle>
}) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canManage', 'canTest', 'canRetry'] as const)

    if (!decision.allowed) {
        const blocker = adminProofBlocker('permission_denied', 'Webhook destination health is not visible for this organization membership.')
        return {
            schemaVersion: 'dwm.webhook.destination_admin_proof.v1',
            liveDeliveryEnabled,
            visibility: decision,
            access,
            productProgress: webhookProductProgressSummary([], liveDeliveryEnabled, [blocker]),
            summary: destinationAdminProofSummary([], [], liveDeliveryEnabled),
            blockers: [blocker],
            destinations: [],
        }
    }

    const sharedProjection = projection || prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const healthRows = preparedHealthRows || buildDwmWebhookDestinationHealthFromProjection({
        ...sharedProjection,
        liveDeliveryEnabled,
    })
    const lifecycleRows = preparedLifecycleRows || buildDwmWebhookDestinationLifecycleFromProjection({
        destinations,
        auditContracts: sharedProjection.auditContracts,
        healthRows,
        viewerRole,
        canManage,
    })
    const operations = buildDwmWebhookDeliveryOperationsFromProjection({
        destinations,
        filters: {},
        liveDeliveryEnabled,
        ledger: sharedProjection.deliveryLedger,
        auditContracts: sharedProjection.auditContracts,
    })
    const lifecycleByDestination = new Map(lifecycleRows.map(row => [row.destinationId, row]))
    const operationsByDestination = new Map<string, typeof operations.recentDeliveries>()
    for (const operation of operations.recentDeliveries) {
        if (!operation.destinationId) continue
        const rows = operationsByDestination.get(operation.destinationId) || []
        rows.push(operation)
        operationsByDestination.set(operation.destinationId, rows)
    }

    const proofs = healthRows.map((health) => {
        const lifecycle = lifecycleByDestination.get(health.destinationId) || null
        const destinationOperations = (operationsByDestination.get(health.destinationId) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestOrgAlert = destinationOperations.find(operation => operation.eventType !== 'dwm.alert.test') || null
        const latestReplay = destinationOperations.find(operation => operation.replay) || null
        const latestSent = destinationOperations.find(operation => operation.status === 'sent') || null
        const latestFailedOrSkipped = destinationOperations.find(operation => operation.status === 'failed' || operation.status === 'skipped') || null
        const blockers = destinationAdminProofBlockers({
            health,
            latestOrgAlert,
            latestSent,
            latestFailedOrSkipped,
        })

        return {
            schemaVersion: 'dwm.webhook.destination_admin_proof_row.v1',
            orgId: health.orgId,
            destinationId: health.destinationId,
            type: health.type,
            label: health.label,
            status: health.status,
            enabled: health.enabled,
            redactedEndpoint: health.redactedEndpoint,
            access: lifecycle?.access || access,
            health: {
                status: health.health,
                ready: health.ready,
                blockers: health.blockers,
                adminProofBlockers: blockers,
                liveDeliveryEnabled: health.liveDeliveryEnabled,
            },
            lifecycle: {
                created: lifecycle?.lifecycle.created || null,
                updated: lifecycle?.lifecycle.updated || null,
                disabled: lifecycle?.lifecycle.disabled || null,
                lastDryRun: health.lastDryRun,
                lastTest: health.lastTest,
                lastLiveDelivery: health.lastDelivery,
                lastFailure: health.lastFailure,
                lastLiveDisabled: health.lastLiveDisabled,
            },
            retry: {
                retryable: health.retry.retryable,
                eligible: access.canRetry && blockers.every(blocker => !['destination_disabled', 'no_live_endpoint', 'no_verified_dry_run', 'permission_denied', 'retry_not_eligible'].includes(blocker.code)),
                nextRetryAt: health.retry.nextRetryAt,
                attemptCount: health.retry.attemptCount,
                lastErrorCategory: health.retry.errorClass,
                reason: health.retry.reason,
                requestId: lifecycle?.retry.requestId || health.lastFailure?.requestId || health.latestAttempt?.requestId || null,
                deliveryId: lifecycle?.retry.deliveryId || health.lastFailure?.deliveryId || health.latestAttempt?.deliveryId || null,
                dedupeKey: lifecycle?.retry.dedupeKey || health.lastFailure?.dedupeKey || health.latestAttempt?.dedupeKey || null,
            },
            deliveryOperations: {
                total: destinationOperations.length,
                recent: destinationOperations.slice(0, 5),
                latestOrgAlert,
            },
            dedupe: {
                duplicateKeyCount: health.idempotencyCoverage.duplicateKeyCount,
                covered: health.idempotencyCoverage.covered,
                latestDedupeKey: latestOrgAlert?.dedupeKey || health.latestAttempt?.dedupeKey || null,
                alreadyDelivered: Boolean(latestSent),
                deliveredRequestId: latestSent?.requestId || null,
            },
            replay: {
                latestReplayRequestId: latestReplay?.requestId || null,
                latestReplayDedupeKey: latestReplay?.dedupeKey || null,
                replayAttemptCount: destinationOperations.filter(operation => operation.replay).length,
            },
            audit: {
                latestAuditEventId: health.latestAuditEventId,
                auditEventIds: health.auditEventIds,
                auditEventContracts: access.canManage ? health.auditEventContracts : [],
            },
            updatedAt: health.updatedAt,
            createdAt: health.createdAt,
        }
    })
    const blockers = uniqueWebhookBlockers(proofs.flatMap(proof => proof.health.adminProofBlockers))

    return {
        schemaVersion: 'dwm.webhook.destination_admin_proof.v1',
        liveDeliveryEnabled,
        visibility: decision,
        access,
        productProgress: webhookProductProgressSummary(proofs, liveDeliveryEnabled, blockers),
        summary: destinationAdminProofSummary(proofs, operations.recentDeliveries, liveDeliveryEnabled),
        blockers,
        destinations: proofs,
    }
}
