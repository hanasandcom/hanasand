import { describe, expect, test } from 'bun:test'
import {
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookDeliveryReadiness,
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDestinationContracts,
    buildDwmWebhookDestinationLifecycle,
} from '../src/utils/dwm/webhooks.ts'
import {
    baseDestination,
    lifecycleFor,
    lifecycleInput,
    testContractFor,
    testDelivery,
} from './fixtures/dwm-webhook-lifecycle.ts'

type LifecycleScenario = {
    name: string
    destination: any
    delivery?: any
    assert: (destination: any, delivery?: any) => void
}

const lifecycleScenarios: LifecycleScenario[] = [
    {
        name: 'dry-run delivery stays unverified across lifecycle, contract, readiness, and consumer views',
        destination: baseDestination,
        delivery: testDelivery('dry_run'),
        assert: (destination, delivery) => {
            const lifecycle = lifecycleFor(destination, delivery)
            expect(lifecycle.lifecycleState).toMatchObject({
                primary: 'test_required', active: false, liveDeliveryUnverified: true, liveVerified: false, verified: false,
            })
            expect(lifecycle.lifecycleReadinessReceipt.status).toMatchObject({
                nextDeliveryState: 'test_required', readyForLive: false,
            })
            expect(testContractFor(destination, delivery).status).toBe('pending')
            const readiness = buildDwmWebhookDeliveryReadiness(lifecycleInput(destination, delivery))
            expect(readiness.destinations[0]).toMatchObject({
                ready: false, blockers: expect.arrayContaining(['test_delivery_unverified']),
            })
            const consumer = buildDwmWebhookDeliveryReadinessConsumerProof(lifecycleInput(destination, delivery))
            expect(consumer.rows[0]).toMatchObject({ state: 'blocked', dryRun: true, readiness: { success: false } })
        },
    },
    {
        name: 'live delivered test enables lifecycle, contract, readiness, and consumer views',
        destination: { ...baseDestination, lastTestStatus: 'delivered' },
        delivery: testDelivery('delivered'),
        assert: (destination, delivery) => {
            const lifecycle = lifecycleFor(destination, delivery)
            expect(lifecycle.lifecycleState).toMatchObject({
                primary: 'active', active: true, liveDeliveryUnverified: false, liveVerified: true,
            })
            expect(lifecycle.lifecycleReadinessReceipt.status).toMatchObject({ nextDeliveryState: 'ready', readyForLive: true })
            expect(testContractFor(destination, delivery).status).toBe('verified')
            expect(buildDwmWebhookDeliveryReadiness(lifecycleInput(destination, delivery)).destinations[0]).toMatchObject({ ready: true })
            expect(buildDwmWebhookDeliveryReadinessConsumerProof(lifecycleInput(destination, delivery)).rows[0]).toMatchObject({
                state: 'idempotent_replay', readiness: { success: true },
            })
        },
    },
    {
        name: 'a delivered row marked dry-run does not verify the destination',
        destination: { ...baseDestination, lastTestStatus: 'delivered' },
        delivery: testDelivery('delivered', true),
        assert: (destination, delivery) => {
            const lifecycle = lifecycleFor(destination, delivery)
            expect(lifecycle.lifecycleState).toMatchObject({
                primary: 'test_required', active: false, liveDeliveryUnverified: true, liveVerified: false, verified: false,
            })
            expect(lifecycle.lifecycleReadinessReceipt.status).toMatchObject({ readyForLive: false })
            expect(testContractFor(destination, delivery).status).toBe('pending')
        },
    },
    {
        name: 'legacy delivered status without delivery evidence remains unknown and pending',
        destination: { ...baseDestination, lastTestStatus: 'delivered' },
        assert: (destination) => {
            const lifecycle = lifecycleFor(destination)
            expect(lifecycle.lifecycleState).toMatchObject({ liveDeliveryUnverified: true, liveVerified: false, verified: false })
            expect(buildDwmWebhookDestinationContracts({ destinations: [destination] })[0]?.lastTest).toMatchObject({
                status: 'unknown', dryRun: null, live: false, requestId: null,
            })
            expect(testContractFor(destination)).toMatchObject({
                status: 'pending', latestTest: { status: 'unknown', dryRun: null, live: false },
            })
        },
    },
    {
        name: 'missing test evidence remains pending',
        destination: { ...baseDestination, lastTestedAt: null, lastTestStatus: null },
        assert: (destination) => expect(testContractFor(destination).status).toBe('pending'),
    },
    {
        name: 'failed test remains a test failure',
        destination: { ...baseDestination, lastTestStatus: 'failed' },
        delivery: testDelivery('dry_run'),
        assert: (destination, delivery) => expect(testContractFor(destination, delivery).status).toBe('test_failed'),
    },
]

describe('dry-run history never makes a webhook destination live-ready', () => {
    for (const scenario of lifecycleScenarios) {
        test(scenario.name, () => scenario.assert(scenario.destination, scenario.delivery))
    }
})

test('terminal delivery failure is consistent across lifecycle and dashboard contracts', () => {
    const terminalFailure = {
        ...testDelivery('delivered', false),
        id: 'delivery_terminal_failure',
        status: 'failed',
        responseStatus: 400,
        responseBody: 'Bad request',
        error: 'Webhook returned HTTP 400.',
        deliveredAt: null,
    } as any
    const lifecycle = buildDwmWebhookDestinationLifecycle({
        destinations: [baseDestination as any],
        deliveries: [terminalFailure],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    const dashboard = buildDwmWebhookDashboardReadinessAdapter({
        destinations: [baseDestination as any],
        deliveries: [terminalFailure],
        liveDeliveryEnabled: true,
    })

    expect(lifecycle.lifecycleState).toMatchObject({ failed: true, states: expect.arrayContaining(['failed']) })
    expect(lifecycle.lifecycleReadinessReceipt).toMatchObject({
        status: { nextDeliveryState: 'terminal_failure' },
        retry: { terminalFailure: true },
    })
    expect(dashboard.summary.terminalFailureCount).toBe(1)
    expect(dashboard.destinations[0].healthStates).toContain('terminal_failure')
    expect(dashboard.destinations[0].blockers.map(blocker => blocker.code)).toContain('terminal_failure')

    const liveDeliveryDisabled = {
        ...testDelivery('delivered', false),
        id: 'delivery_live_disabled',
        status: 'skipped',
        error: 'Live DWM webhook delivery is disabled for this environment.',
        deliveredAt: null,
    } as any
    const disabledLifecycle = buildDwmWebhookDestinationLifecycle({
        destinations: [baseDestination as any],
        deliveries: [liveDeliveryDisabled],
        liveDeliveryEnabled: false,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    const disabledDashboard = buildDwmWebhookDashboardReadinessAdapter({
        destinations: [baseDestination as any],
        deliveries: [liveDeliveryDisabled],
        liveDeliveryEnabled: false,
    })

    expect(disabledLifecycle.lifecycleState.failed).toBe(false)
    expect(disabledLifecycle.lifecycleReadinessReceipt.retry.terminalFailure).toBe(false)
    expect(disabledDashboard.summary.terminalFailureCount).toBe(0)
    expect(disabledDashboard.destinations[0].healthStates).not.toContain('terminal_failure')
    expect(disabledDashboard.destinations[0].blockers.map(blocker => blocker.code)).not.toContain('terminal_failure')

    const failedTest = buildDwmWebhookDestinationLifecycle({
        destinations: [{ ...baseDestination, lastTestStatus: 'failed' } as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    expect(failedTest.lifecycleState.failed).toBe(true)
    expect(failedTest.lifecycleReadinessReceipt.retry.terminalFailure).toBe(false)
})
