import { clean } from '../../webhookValueUtils.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDestinationLifecycleOptions } from './webhook-contract-types.ts'
import { type DwmWebhookDestinationProjection, prepareDwmWebhookDestinationProjection, buildDwmWebhookDestinationHealthFromProjection } from './dwm-webhook-destination-projection.ts'
import { type buildDwmWebhookDestinationHealth } from './destination-health.ts'
import { destinationLifecycleState } from './destination-lifecycle-state.ts'
import { destinationLifecycleReadinessReceipt } from './destination-lifecycle-readiness-receipt.ts'
import { lifecycleEvent } from './destination-health-attempt.ts'

export function buildDwmWebhookDestinationLifecycleFromProjection({
    destinations,
    auditContracts,
    healthRows,
    viewerRole,
    canManage,
}: {
    destinations: DwmWebhookDestinationPublic[]
    auditContracts: DwmWebhookDestinationProjection['auditContracts']
    healthRows: ReturnType<typeof buildDwmWebhookDestinationHealth>
    viewerRole: string | null
    canManage: boolean
}) {
    const auditByDestination = new Map<string, typeof auditContracts>()
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }

    return healthRows.map((health) => {
        const audits = auditByDestination.get(health.destinationId) || []
        const created = audits.find(audit => audit.action === 'destination.created') || null
        const updated = audits.find(audit => audit.action === 'destination.updated') || null
        const disabled = audits.find(audit => audit.action === 'destination.archived') || null
        const replay = health.recentAttempts.find(attempt => attempt.eventType === 'dwm.alert.replayed') || null
        const adminAuditEvents = canManage ? audits : []
        const destination = destinationById.get(health.destinationId) || null
        const lifecycleState = destinationLifecycleState({ destination, health, audits, canManage })
        const lifecycleReadinessReceipt = destinationLifecycleReadinessReceipt({ health, lifecycleState, canManage })

        return {
            schemaVersion: 'dwm.webhook.destination_lifecycle.v1',
            destinationId: health.destinationId,
            orgId: health.orgId,
            type: health.type,
            label: health.label,
            status: health.status,
            enabled: health.enabled,
            view: canManage ? 'admin' : 'member',
            access: {
                role: clean(viewerRole) || null,
                canReadStatus: true,
                canManage,
                canUpdate: canManage,
                canTest: canManage,
                canDisable: canManage && health.enabled,
                memberSafe: !canManage,
            },
            lifecycleState,
            lifecycleReadinessReceipt,
            redactedEndpoint: health.redactedEndpoint,
            lifecycle: {
                created: lifecycleEvent(created, canManage),
                updated: lifecycleEvent(updated, canManage),
                disabled: lifecycleEvent(disabled, canManage),
                lastDryRun: health.lastDryRun,
                lastTest: health.lastTest,
                lastReplay: replay,
                lastDelivery: health.lastDelivery,
                lastFailure: health.lastFailure,
                lastLiveDisabled: health.lastLiveDisabled,
            },
            retry: {
                retryable: health.retry.retryable,
                nextRetryAt: health.retry.nextRetryAt,
                attemptCount: health.retry.attemptCount,
                lastErrorCategory: health.retry.errorClass,
                reason: health.retry.reason,
                requestId: health.lastFailure?.requestId || health.latestAttempt?.requestId || null,
                deliveryId: health.lastFailure?.deliveryId || health.latestAttempt?.deliveryId || null,
                dedupeKey: health.lastFailure?.dedupeKey || health.latestAttempt?.dedupeKey || null,
                redactedEndpoint: health.redactedEndpoint,
            },
            health: {
                status: health.health,
                ready: health.ready,
                blockers: health.blockers,
                liveDeliveryEnabled: health.liveDeliveryEnabled,
                idempotencyCoverage: health.idempotencyCoverage,
            },
            auditEventIds: health.auditEventIds,
            latestAuditEventId: health.latestAuditEventId,
            auditEventContracts: adminAuditEvents,
            updatedAt: health.updatedAt,
            createdAt: health.createdAt,
        }
    })
}

export function buildDwmWebhookDestinationLifecycle({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: DwmWebhookDestinationLifecycleOptions) {
    const projection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const healthRows = buildDwmWebhookDestinationHealthFromProjection({ ...projection, liveDeliveryEnabled })
    return buildDwmWebhookDestinationLifecycleFromProjection({
        destinations,
        auditContracts: projection.auditContracts,
        healthRows,
        viewerRole,
        canManage,
    })
}
