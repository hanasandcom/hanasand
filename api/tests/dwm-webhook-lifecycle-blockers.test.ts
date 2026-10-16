import { expect, test } from 'bun:test'
import {
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookDestinationTestContract,
} from '../src/utils/dwm/webhooks.ts'

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
