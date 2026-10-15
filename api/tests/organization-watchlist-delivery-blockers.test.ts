import { expect, test } from 'bun:test'
import { organizationWatchlistAlertTermsExport } from '../src/utils/organizations.ts'

test('watchlist delivery projections share ordered blocker results', () => {
    const organization = {
        id: 'org-1',
        name: 'Org One',
        slug: 'org-one',
        created_by: 'owner-1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        status: 'active' as const,
        member_count: 1,
        owner_count: 1,
        admin_count: 1,
        pending_invite_count: 0,
        shared_watchlist_count: 1,
        default_webhook_policy: 'manual_selection' as const,
        alert_visibility_policy: 'members' as const,
        role: 'owner' as const,
    }
    const item = {
        id: 'watchlist-1',
        organization_id: organization.id,
        kind: 'domain' as const,
        value: 'example.com',
        notes: '',
        status: 'active' as const,
        created_by: 'owner-1',
        updated_by: 'owner-1',
        lifecycle_reason: null,
        lifecycle_request_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        archived_at: null,
    }

    const result = organizationWatchlistAlertTermsExport(organization, [item], {
        userId: 'owner-1',
        role: 'owner',
    })
    const readiness = result.webhookDestinationAccessDecision.alertDeliveryReadiness
    const receipt = result.webhookDestinationAccessDecision.deliveryConsumerReceipt
    const match = receipt.watchlistMatches[0]

    expect(receipt.blockerCodes).toEqual(['manual_webhook_selection_required'])
    expect(readiness.blockerCodes).toEqual(receipt.blockerCodes)
    expect(readiness.blockerCodes).not.toBe(receipt.blockerCodes)
    expect(receipt.blockerReason).toBe(receipt.blockerCodes[0] ?? null)
    expect(match.workflowStatus).toBe(receipt.blockerCodes.length === 0 ? 'ready_for_delivery' : 'blocked')
    expect(match.destinationReadiness.blockerReason).toBe(receipt.blockerCodes[0] ?? null)
})
