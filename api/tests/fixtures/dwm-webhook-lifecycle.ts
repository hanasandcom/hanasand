import {
    buildDwmWebhookDestinationLifecycle,
    buildDwmWebhookDestinationTestContract,
} from '../../src/utils/dwm/webhooks.ts'

export const baseDestination = {
    id: 'destination_1',
    ownerId: 'owner_1',
    orgId: 'org_1',
    name: 'Research receiver',
    kind: 'webhook',
    endpointHint: 'receiver.example/...',
    endpointHash: 'endpoint_hash',
    status: 'active',
    events: ['dwm.alert.created'],
    createdBy: 'owner_1',
    lastTestedAt: '2026-08-09T10:00:00.000Z',
    lastTestStatus: 'dry_run',
    lastTestError: null,
    lastTestHttpStatus: 204,
    lastDeliveryAt: null,
    createdAt: '2026-08-09T09:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z',
    signingConfigured: true,
} as const

export function testDelivery(status: 'dry_run' | 'delivered', dryRun = status === 'dry_run') {
    return {
        id: `delivery_${status}`,
        destinationId: baseDestination.id,
        ownerId: baseDestination.ownerId,
        orgId: baseDestination.orgId,
        alertId: 'alert_test',
        eventType: 'dwm.alert.test',
        status,
        dryRun,
        endpointHint: baseDestination.endpointHint,
        endpointHash: baseDestination.endpointHash,
        payloadHash: 'payload_hash',
        payload: {},
        responseStatus: 204,
        responseBody: null,
        error: null,
        errorClass: null,
        attemptCount: 1,
        nextRetryAt: null,
        idempotencyKey: `idempotency_${status}`,
        watchlistId: null,
        watchlistName: null,
        route: 'POST /api/dwm/webhook-destinations/destination_1/test',
        casePath: null,
        attemptedAt: '2026-08-09T10:00:00.000Z',
        completedAt: '2026-08-09T10:00:00.100Z',
        deliveredAt: status === 'delivered' ? '2026-08-09T10:00:00.100Z' : null,
        createdAt: '2026-08-09T10:00:00.000Z',
        auditEventId: null,
        auditAction: null,
        auditActorId: null,
        reportValidation: null,
        reportExportChecksum: null,
        reportCaseId: null,
    }
}

export function lifecycleInput(destination: any, delivery?: any) {
    return {
        destinations: [destination],
        deliveries: delivery ? [delivery] : [],
        liveDeliveryEnabled: true,
        viewerRole: 'owner' as const,
        canManage: true,
    }
}

export function lifecycleFor(destination: any, delivery?: any) {
    return buildDwmWebhookDestinationLifecycle(lifecycleInput(destination, delivery))[0]!
}

export function testContractFor(destination: any, delivery?: any) {
    return buildDwmWebhookDestinationTestContract({
        destination,
        deliveries: delivery ? [delivery] : [],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
}
