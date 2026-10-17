import type { buildDwmWebhookDestinationAdminProof } from './implementation/destination-admin-proof.ts'
import type { buildDwmWebhookDestinationDeliveryMatrix } from './implementation/delivery-retry-work-orders.ts'

type Matrix = ReturnType<typeof buildDwmWebhookDestinationDeliveryMatrix>
type AdminProof = ReturnType<typeof buildDwmWebhookDestinationAdminProof>

export function buildDwmWebhookDestinationLookupProjection(
    matrix: Matrix,
    adminProof: AdminProof,
    liveDeliveryEnabled: boolean,
    canManage: boolean,
) {
    const adminByDestination = new Map(adminProof.destinations.map(destination => [destination.destinationId, destination]))
    const rows = matrix.destinations.map((destination) => {
        const proof = adminByDestination.get(destination.destinationId) || null
        return {
            schemaVersion: 'dwm.webhook.destination_lookup_row.v1',
            orgId: destination.orgId,
            destinationId: destination.destinationId,
            label: destination.label,
            type: destination.type,
            status: destination.status,
            enabled: destination.enabled,
            redactedDestination: {
                id: destination.destinationId,
                label: destination.label,
                type: destination.type,
                endpointHint: destination.redactedEndpoint.endpointHint,
                endpointHash: destination.redactedEndpoint.endpointHash,
                endpointExposed: false,
            },
            subscribedEvents: destination.subscribedEvents,
            delivery: {
                latestDeliveryAt: destination.deliveryProof.latestDeliveryAt,
                lastTestId: destination.deliveryProof.lastTest?.deliveryId || null,
                lastOrgAlertId: destination.deliveryProof.lastOrgAlert?.deliveryId || null,
                lastReplayId: destination.deliveryProof.lastReplayed?.deliveryId || null,
                latestAuditEventId: destination.health.latestAuditEventId || destination.audit.latestAuditEventId,
            },
            retry: {
                ready: destination.retry.ready,
                nextRetryAt: destination.retry.nextRetryAt,
                lastErrorCategory: destination.retry.lastErrorCategory,
                idempotencyKey: destination.retry.idempotencyKey,
            },
            replay: destination.replay,
            health: {
                status: destination.health.status,
                ready: destination.health.ready,
                states: destination.health.states,
                blockers: destination.health.blockers,
                productProgressStatus: adminProof.productProgress.status,
            },
            idempotency: {
                duplicateKeyCount: proof?.dedupe.duplicateKeyCount || 0,
                alreadyDelivered: proof?.dedupe.alreadyDelivered || false,
                latestDedupeKey: proof?.dedupe.latestDedupeKey || destination.replay.latestDedupeKey || null,
            },
            audit: {
                latestAuditEventId: destination.audit.latestAuditEventId || proof?.audit.latestAuditEventId || null,
                auditEventIds: destination.audit.auditEventIds,
                contracts: canManage ? destination.audit.auditEventContracts : [],
            },
            routes: {
                destinationDetail: `GET /api/dwm/webhooks?orgId=${encodeURIComponent(destination.orgId)}&destinationId=${encodeURIComponent(destination.destinationId)}`,
                deliveryHistory: destination.routes.detail,
                test: destination.routes.test,
                update: `PUT /api/dwm/webhook-destinations/${encodeURIComponent(destination.destinationId)}`,
                disable: destination.routes.delete,
                delete: destination.routes.delete,
                retryDryRun: matrix.routes.triggerDelivery,
            },
            blockers: destination.blockers,
            updatedAt: destination.updatedAt,
            createdAt: destination.createdAt,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.destination_lookup.v1',
        noNetwork: true,
        liveDeliveryEnabled,
        visibility: matrix.visibility,
        access: matrix.access,
        routeContract: {
            schemaVersion: 'dwm.webhook.destination_lookup_routes.v1',
            list: {
                method: 'GET' as const,
                route: '/api/dwm/webhooks',
                requiredQuery: ['orgId'],
                optionalQuery: ['destinationId'],
                responseRowSchema: 'dwm.webhook.destination_lookup_row.v1',
                noNetwork: true,
            },
            update: {
                method: 'PUT' as const,
                route: '/api/dwm/webhook-destinations/:id',
                requiredBody: ['orgId'],
                optionalBody: ['name', 'label', 'endpointUrl', 'kind', 'events', 'status'],
                noNetwork: true,
            },
            test: {
                method: 'POST' as const,
                route: '/api/dwm/webhook-destinations/:id/test',
                requiredBody: ['orgId', 'dryRun'],
                noNetworkDefault: true,
            },
            disable: {
                method: 'DELETE' as const,
                route: '/api/dwm/webhook-destinations/:id',
                requiredQuery: ['orgId'],
                noNetwork: true,
            },
        },
        summary: {
            destinationCount: rows.length,
            activeDestinationCount: rows.filter(row => row.enabled).length,
            readyDestinationCount: rows.filter(row => row.health.ready).length,
            retryReadyCount: rows.filter(row => row.retry.ready).length,
            auditLinkedCount: rows.filter(row => row.audit.latestAuditEventId).length,
            blockedCount: rows.filter(row => row.blockers.some(blocker => blocker.blocking)).length,
        },
        productProgress: adminProof.productProgress,
        destinations: rows,
        blockers: matrix.blockers,
    }
}
