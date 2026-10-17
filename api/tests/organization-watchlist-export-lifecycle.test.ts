import { expect, test } from 'bun:test'
import { organizationWatchlistAlertTermsExport, organizationWatchlistAlertTermsExportDenial, toWatchlistItem } from '../src/utils/organizations.ts'

const organization = {
    id: 'org-1',
    name: 'Org One',
    slug: 'org-one',
    created_by: 'owner-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    status: 'active' as const,
    member_count: 3,
    owner_count: 1,
    admin_count: 1,
    pending_invite_count: 0,
    shared_watchlist_count: 3,
    default_webhook_policy: 'active_destinations' as const,
    alert_visibility_policy: 'members' as const,
    role: 'owner' as const,
}

function watchlistItem(input: {
    id: string
    kind: 'domain' | 'keyword' | 'vendor'
    value: string
    status: 'active' | 'paused' | 'archived'
    archivedAt?: string
}) {
    return {
        id: input.id,
        organization_id: organization.id,
        kind: input.kind,
        value: input.value,
        notes: '',
        status: input.status,
        created_by: 'owner-1',
        updated_by: 'owner-1',
        lifecycle_reason: input.status === 'active' ? null : 'Review requested',
        lifecycle_request_id: input.status === 'active' ? null : `request-${input.id}`,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        archived_at: input.archivedAt ?? null,
    }
}

test('watchlist item alert reference preserves lifecycle state', () => {
    expect(toWatchlistItem(watchlistItem({ id: 'paused-1', kind: 'keyword', value: 'launch plan', status: 'paused' })).alertGenerationReference)
        .toMatchObject({ status: 'paused', enabled: false, disabledReason: 'watchlist_paused' })
    expect(toWatchlistItem(watchlistItem({ id: 'archived-1', kind: 'vendor', value: 'Acme', status: 'archived' })).alertGenerationReference)
        .toMatchObject({ status: 'archived', enabled: false, disabledReason: 'watchlist_archived' })
})
test('alert term export denial preserves explicit tenant identity and fallback order', () => {
    const input = {
        organizationId: 'org-1',
        member: { userId: 'member-1', role: 'reader' as const },
        visibility: {
            allowed: false,
            reason: 'role_not_allowed' as const,
            alertVisibilityPolicy: 'owners' as const,
            allowedRoles: ['owner' as const],
        },
    }

    const explicitTenant = organizationWatchlistAlertTermsExportDenial({ ...input, tenantId: 'tenant-1' })
    const nullTenant = organizationWatchlistAlertTermsExportDenial({ ...input, tenantId: null })

    expect(Object.keys(explicitTenant).slice(0, 3)).toEqual(['schemaVersion', 'organizationId', 'tenantId'])
    expect(explicitTenant).toMatchObject({ organizationId: 'org-1', tenantId: 'tenant-1' })
    expect(Object.keys(explicitTenant.alertGenerationConsumerDenial).slice(0, 3)).toEqual([
        'schemaVersion', 'organizationId', 'tenantId',
    ])
    expect(explicitTenant.alertGenerationConsumerDenial).toMatchObject({ organizationId: 'org-1', tenantId: 'tenant-1' })
    expect(nullTenant).toMatchObject({ organizationId: 'org-1', tenantId: 'org-1' })
    expect(nullTenant.alertGenerationConsumerDenial).toMatchObject({ organizationId: 'org-1', tenantId: 'org-1' })
})
test('archived timestamp overrides status while inactive organizations retain lifecycle IDs', () => {
    const result = organizationWatchlistAlertTermsExport({ ...organization, status: 'archived' }, [
        watchlistItem({ id: 'active-1', kind: 'domain', value: 'example.com', status: 'active' }),
        watchlistItem({
            id: 'archived-by-timestamp',
            kind: 'keyword',
            value: 'launch plan',
            status: 'active',
            archivedAt: '2026-02-01T00:00:00.000Z',
        }),
    ], { userId: 'owner-1', role: 'owner' })

    expect(result.activeTerms).toEqual([])
    expect(result.termLifecycle.activeItemIds).toEqual(['active-1'])
    expect(result.termLifecycle.archivedItemIds).toEqual(['archived-by-timestamp'])
    expect(result.termLifecycle.excludedFromAlertMatching).toMatchObject([
        { watchlistItemId: 'archived-by-timestamp', status: 'archived', deletedByArchive: true },
    ])
    expect(result.excluded).toEqual({ pausedCount: 0, archivedCount: 1, inactiveCount: 1 })
    expect(result.downstreamAuthorization.watchlists.states).toEqual([
        { watchlistItemId: 'active-1', kind: 'domain', status: 'active' },
        { watchlistItemId: 'archived-by-timestamp', kind: 'keyword', status: 'archived' },
    ])
    expect(result.canGenerateAlerts).toBe(false)
})
