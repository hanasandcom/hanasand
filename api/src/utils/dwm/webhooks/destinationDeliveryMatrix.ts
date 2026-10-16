import type {
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryRetryQueue,
    buildDwmWebhookDestinationHealth,
} from '../webhooks.ts'
import type { buildDwmWebhookAuditEventContracts } from '../webhookAuditContracts.ts'
import type { toDwmWebhookDestination } from '../webhookDestinationModels.ts'
import { redactDeliveryEvidenceText } from '../webhookDeliveryUtilities.ts'
import { makeWebhookBlocker, uniqueWebhookBlockers } from '../webhookValueUtils.ts'

type Destination = ReturnType<typeof toDwmWebhookDestination>

export function buildDwmWebhookDestinationDeliveryMatrixProjection({
    destinations,
    healthRows,
    operations,
    retryQueue,
    auditContracts,
    liveDeliveryEnabled,
    decision,
    access,
    healthStates,
}: {
    destinations: Destination[]
    healthRows: ReturnType<typeof buildDwmWebhookDestinationHealth>
    operations: ReturnType<typeof buildDwmWebhookDeliveryOperations>
    retryQueue: ReturnType<typeof buildDwmWebhookDeliveryRetryQueue>
    auditContracts: ReturnType<typeof buildDwmWebhookAuditEventContracts>
    liveDeliveryEnabled: boolean
    decision: unknown
    access: { canManage: boolean }
    healthStates: (health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]) => string[]
}) {
    const healthByDestination = new Map(healthRows.map(health => [health.destinationId, health]))
    const retryEntriesByDestination = new Map<string, typeof retryQueue.entries>()
    for (const entry of retryQueue.entries) {
        if (!entry.destinationId) continue
        const rows = retryEntriesByDestination.get(entry.destinationId) || []
        rows.push(entry)
        retryEntriesByDestination.set(entry.destinationId, rows)
    }
    const operationsByDestination = new Map<string, typeof operations.recentDeliveries>()
    for (const operation of operations.recentDeliveries) {
        if (!operation.destinationId) continue
        const rows = operationsByDestination.get(operation.destinationId) || []
        rows.push(operation)
        operationsByDestination.set(operation.destinationId, rows)
    }
    const auditByDestination = new Map<string, typeof auditContracts>()
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const rows = auditByDestination.get(audit.destinationId) || []
        rows.push(audit)
        auditByDestination.set(audit.destinationId, rows)
    }

    const rows = destinations.map((destination) => {
        const health = healthByDestination.get(destination.id) || null
        const destinationOperations = (operationsByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const retryEntries = (retryEntriesByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.latestAttempt.attemptedAt).localeCompare(String(a.latestAttempt.attemptedAt)))
        const audits = (auditByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const lastTest = destinationOperations.find(operation => operation.eventType === 'dwm.alert.test') || null
        const lastCreated = destinationOperations.find(operation => operation.eventType === 'dwm.alert.created') || null
        const lastReplayed = destinationOperations.find(operation => operation.eventType === 'dwm.alert.replayed') || null
        const lastOrgAlert = destinationOperations.find(operation => operation.eventType !== 'dwm.alert.test') || null
        const retryReady = retryEntries.find(entry => entry.retry.dryRunReady) || null
        const terminalFailure = retryEntries.find(entry => entry.retry.terminalFailure) || null
        const blockers = []
        if (destination.status !== 'active') blockers.push(makeWebhookBlocker('destination_disabled', 'Destination is disabled.', destination.id, true))
        if (!destination.endpointHash && !destination.endpointHint) blockers.push(makeWebhookBlocker('missing_webhook_url', 'Destination has no configured webhook URL reference.', destination.id, true))
        if (!lastTest) blockers.push(makeWebhookBlocker('no_verified_dry_run', 'Destination has no dry-run/test delivery proof.', destination.id, false))
        if (!lastOrgAlert) blockers.push(makeWebhookBlocker('missing_org_alert_context', 'Destination has no org alert delivery proof yet.', destination.id, false))
        if (retryReady) blockers.push(makeWebhookBlocker('retry_scheduled', 'Destination has a retryable failed delivery.', destination.id, false))
        if (terminalFailure) blockers.push(makeWebhookBlocker('terminal_failure', 'Destination has a terminal failed delivery.', destination.id, true))
        if (!liveDeliveryEnabled) blockers.push(makeWebhookBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', destination.id, false))

        return {
            schemaVersion: 'dwm.webhook.destination_delivery_matrix_row.v1',
            orgId: destination.orgId,
            destinationId: destination.id,
            type: destination.kind,
            label: destination.name,
            status: destination.status,
            enabled: destination.status === 'active',
            redactedEndpoint: {
                endpointHint: redactDeliveryEvidenceText(destination.endpointHint),
                endpointHash: destination.endpointHash,
            },
            subscribedEvents: destination.events,
            eventCoverage: {
                created: destination.events.includes('dwm.alert.created'),
                replayed: destination.events.includes('dwm.alert.replayed'),
                test: true,
            },
            deliveryProof: {
                lastTest,
                lastCreated,
                lastReplayed,
                lastOrgAlert,
                latestDeliveryAt: lastOrgAlert?.attemptedAt || lastTest?.attemptedAt || null,
            },
            health: {
                status: health?.health || (destination.status === 'active' ? 'blocked' : 'disabled'),
                ready: health?.ready || false,
                states: health ? healthStates(health) : [],
                blockers: health?.blockers || [],
                latestAuditEventId: health?.latestAuditEventId || audits[0]?.auditEventId || null,
            },
            retry: {
                ready: Boolean(retryReady),
                dryRunReady: Boolean(retryReady?.retry.dryRunReady),
                liveReady: Boolean(retryReady?.retry.liveReady),
                nextRetryAt: retryReady?.retry.nextRetryAt || null,
                lastErrorCategory: retryReady?.retry.lastErrorCategory || terminalFailure?.retry.lastErrorCategory || null,
                requestId: retryReady?.latestAttempt.requestId || terminalFailure?.latestAttempt.requestId || null,
                idempotencyKey: retryReady?.idempotencyKey || terminalFailure?.idempotencyKey || null,
            },
            replay: {
                latestRequestId: lastReplayed?.requestId || null,
                latestDedupeKey: lastReplayed?.dedupeKey || null,
                count: destinationOperations.filter(operation => operation.replay).length,
            },
            audit: {
                latestAuditEventId: health?.latestAuditEventId || audits[0]?.auditEventId || null,
                auditEventIds: [...new Set([
                    health?.latestAuditEventId,
                    ...audits.map(audit => audit.auditEventId),
                ].filter(Boolean) as string[])],
                auditEventContracts: access.canManage ? audits.slice(0, 10) : [],
            },
            blockers: uniqueWebhookBlockers(blockers),
            routes: {
                detail: `GET /api/dwm/webhook-deliveries?orgId=${encodeURIComponent(destination.orgId)}&destinationId=${encodeURIComponent(destination.id)}`,
                test: `POST /api/dwm/webhook-destinations/${encodeURIComponent(destination.id)}/test`,
                delete: `DELETE /api/dwm/webhook-destinations/${encodeURIComponent(destination.id)}`,
                archive: `DELETE /api/dwm/webhook-destinations/${encodeURIComponent(destination.id)}`,
                trigger: 'POST /api/dwm/webhook-deliveries',
            },
            updatedAt: destination.updatedAt,
            createdAt: destination.createdAt,
        }
    })
    const blockers = uniqueWebhookBlockers(rows.flatMap(row => row.blockers))
    const latestDeliveryAt = rows
        .map(row => row.deliveryProof.latestDeliveryAt)
        .filter(Boolean)
        .sort((a, b) => String(b).localeCompare(String(a)))[0] || null

    return {
        schemaVersion: 'dwm.webhook.destination_delivery_matrix.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        visibility: decision,
        access,
        summary: {
            destinationCount: rows.length,
            activeDestinationCount: rows.filter(row => row.enabled).length,
            deliveryConfiguredCount: rows.filter(row => row.deliveryProof.lastOrgAlert || row.deliveryProof.lastTest).length,
            retryReadyCount: rows.filter(row => row.retry.ready).length,
            blockedCount: rows.filter(row => row.blockers.some(blocker => blocker.blocking)).length,
            latestDeliveryAt,
        },
        blockers,
        destinations: rows,
        routes: {
            destinationList: 'GET /api/dwm/webhooks?orgId=<org_id>',
            deliveryList: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
            testDestination: 'POST /api/dwm/webhook-destinations/:id/test',
            triggerDelivery: 'POST /api/dwm/webhook-deliveries',
        },
    }
}
