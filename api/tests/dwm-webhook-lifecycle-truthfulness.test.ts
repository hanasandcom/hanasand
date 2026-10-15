import { expect, test } from 'bun:test'
import { buildDwmWebhookDashboardReadinessAdapter, buildDwmWebhookDeliveryReadiness, buildDwmWebhookDeliveryReadinessConsumerProof, buildDwmWebhookDestinationContracts, buildDwmWebhookDestinationLifecycle, buildDwmWebhookDestinationTestContract } from '../src/utils/dwm/webhooks.ts'

const baseDestination = {
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

function testDelivery(status: 'dry_run' | 'delivered', dryRun = status === 'dry_run') {
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

test('dashboard blocker deduplication keeps distinct policy reasons in source order', () => {
    const readiness = buildDwmWebhookDashboardReadinessAdapter({
        destinations: [],
        orgStatus: 'archived',
        watchlistStatus: 'retired',
    })

    expect(readiness.blockers).toEqual([
        {
            code: 'policy_blocked',
            message: 'Organization lifecycle blocks webhook delivery.',
            destinationId: null,
            reason: 'org_archived',
            blocking: true,
        },
        {
            code: 'policy_blocked',
            message: 'Retired or archived watchlist blocks alert delivery.',
            destinationId: null,
            reason: 'watchlist_retired',
            blocking: true,
        },
    ])
})

test('destination test blockers keep their public fields and declaration order', () => {
    const contract = buildDwmWebhookDestinationTestContract({
        destination: null,
        viewerRole: 'member',
        canManage: false,
        liveDeliveryEnabled: false,
    })

    expect(contract.blockers).toEqual([
        {
            code: 'permission_denied',
            message: 'Only organization owners and admins can test webhook destinations.',
            destinationId: null,
            blocking: true,
        },
        {
            code: 'destination_missing',
            message: 'Webhook destination is not available for this organization.',
            destinationId: null,
            blocking: true,
        },
        {
            code: 'no_verified_dry_run',
            message: 'Destination has not recorded a dry-run test delivery yet.',
            destinationId: null,
            blocking: false,
        },
        {
            code: 'audit_missing',
            message: 'Destination test has no linked audit event yet.',
            destinationId: null,
            blocking: false,
        },
        {
            code: 'live_delivery_disabled',
            message: 'Live webhook delivery is disabled for this environment; tests default to dry-run.',
            destinationId: null,
            blocking: false,
        },
    ])
})

test('dry-run history never makes a webhook destination live-ready', () => {
    const dryRun = buildDwmWebhookDestinationLifecycle({
        destinations: [baseDestination as any],
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    expect(dryRun.lifecycleState).toMatchObject({
        primary: 'test_required',
        active: false,
        liveDeliveryUnverified: true,
        liveVerified: false,
        verified: false,
    })
    expect(dryRun.lifecycleReadinessReceipt.status).toMatchObject({
        nextDeliveryState: 'test_required',
        readyForLive: false,
    })

    const delivered = buildDwmWebhookDestinationLifecycle({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        deliveries: [testDelivery('delivered') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    expect(delivered.lifecycleState).toMatchObject({
        primary: 'active',
        active: true,
        liveDeliveryUnverified: false,
        liveVerified: true,
    })
    expect(delivered.lifecycleReadinessReceipt.status).toMatchObject({
        nextDeliveryState: 'ready',
        readyForLive: true,
    })

    const deliveredDryRun = buildDwmWebhookDestinationLifecycle({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        deliveries: [testDelivery('delivered', true) as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    expect(deliveredDryRun.lifecycleState).toMatchObject({
        primary: 'test_required',
        active: false,
        liveDeliveryUnverified: true,
        liveVerified: false,
        verified: false,
    })
    expect(deliveredDryRun.lifecycleReadinessReceipt.status).toMatchObject({
        readyForLive: false,
    })

    const deliveredDryRunContract = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestStatus: 'delivered' } as any,
        deliveries: [testDelivery('delivered', true) as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(deliveredDryRunContract.status).toBe('pending')

    const legacyDelivered = buildDwmWebhookDestinationLifecycle({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    expect(legacyDelivered.lifecycleState).toMatchObject({
        liveDeliveryUnverified: true,
        liveVerified: false,
        verified: false,
    })
    const legacyDeliveredContract = buildDwmWebhookDestinationContracts({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
    })[0]
    expect(legacyDeliveredContract.lastTest).toMatchObject({
        status: 'unknown',
        dryRun: null,
        live: false,
        requestId: null,
    })

    const legacyDeliveredTestContract = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestStatus: 'delivered' } as any,
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(legacyDeliveredTestContract).toMatchObject({
        status: 'pending',
        latestTest: { status: 'unknown', dryRun: null, live: false },
    })

    const noTest = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestedAt: null, lastTestStatus: null } as any,
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(noTest.status).toBe('pending')

    const failed = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestStatus: 'failed' } as any,
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(failed.status).toBe('test_failed')

    const dryRunContract = buildDwmWebhookDestinationTestContract({
        destination: baseDestination as any,
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(dryRunContract.status).toBe('pending')

    const dryRunReadiness = buildDwmWebhookDeliveryReadiness({
        destinations: [baseDestination as any],
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
    })
    expect(dryRunReadiness.destinations[0]).toMatchObject({
        ready: false,
        blockers: expect.arrayContaining(['test_delivery_unverified']),
    })

    const deliveredContract = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestStatus: 'delivered' } as any,
        deliveries: [testDelivery('delivered') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(deliveredContract.status).toBe('verified')

    const deliveredReadiness = buildDwmWebhookDeliveryReadiness({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        deliveries: [testDelivery('delivered') as any],
        liveDeliveryEnabled: true,
    })
    expect(deliveredReadiness.destinations[0]).toMatchObject({ ready: true })

    const dryRunConsumerReadiness = buildDwmWebhookDeliveryReadinessConsumerProof({
        destinations: [baseDestination as any],
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(dryRunConsumerReadiness.rows[0]).toMatchObject({
        state: 'blocked',
        dryRun: true,
        readiness: { success: false },
    })

    const deliveredConsumerReadiness = buildDwmWebhookDeliveryReadinessConsumerProof({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        deliveries: [testDelivery('delivered') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(deliveredConsumerReadiness.rows[0]).toMatchObject({
        state: 'idempotent_replay',
        readiness: { success: true },
    })
})
