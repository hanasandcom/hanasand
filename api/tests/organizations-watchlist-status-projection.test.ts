import { expect, test } from 'bun:test'
import {
    organizationDownstreamAuthorizationExport,
    organizationSharedWatchlistProjection,
    organizationSharedWatchlistDownstreamProof,
    organizationWatchlistAlertGenerationContract,
} from '../src/utils/organizations.ts'

const organization = {
    id: 'org-status-projection',
    name: 'Status Projection',
    slug: 'status-projection',
    status: 'active' as const,
    member_count: 1,
    owner_count: 1,
    pending_invite_count: 0,
    shared_watchlist_count: 4,
    default_webhook_policy: 'active_destinations' as const,
    alert_visibility_policy: 'members' as const,
    role: 'owner' as const,
}
const member = { userId: 'owner-1', role: 'owner' as const }
const items = [
    { id: 'archived', kind: 'vendor' as const, value: 'Acme', status: 'archived' as const },
    { id: 'active-z', kind: 'domain' as const, value: 'z.example', status: 'active' as const },
    { id: 'paused', kind: 'keyword' as const, value: 'launch plan', status: 'paused' as const },
    { id: 'active-a', kind: 'domain' as const, value: 'a.example', status: 'active' as const },
].map(item => ({
    ...item,
    organization_id: organization.id,
    notes: '',
    created_by: member.userId,
    updated_by: member.userId,
    lifecycle_reason: item.status === 'active' ? null : 'Review requested',
    lifecycle_request_id: item.status === 'active' ? null : `request-${item.id}`,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    archived_at: item.status === 'archived' ? '2026-02-01T00:00:00.000Z' : null,
}))

test('downstream contracts share lifecycle ID projections without changing order or export policy', () => {
    const alertGeneration = organizationWatchlistAlertGenerationContract(organization, items)
    const authorization = organizationDownstreamAuthorizationExport(organization, items, member)
    const proof = organizationSharedWatchlistDownstreamProof(organization, items, member, alertGeneration, authorization)
    const projection = organizationSharedWatchlistProjection(organization, items, member)

    expect(Object.keys(projection)).toEqual([
        'alertGeneration', 'downstreamAuthorization', 'sharedWatchlistDownstreamProof',
    ])
    expect(Object.keys(projection.alertGeneration)).toEqual([
        'schemaVersion', 'organizationId', 'tenantId', 'ownerOrganizationId', 'visibilityPolicy',
        'allowedViewerRoles', 'activeWatchlistTerms', 'termFamilies', 'blockedReasons', 'canGenerateAlerts',
    ])
    expect(Object.keys(projection.downstreamAuthorization)).toEqual([
        'schemaVersion', 'organizationId', 'tenantId', 'organizationLifecycleState', 'member', 'visibility',
        'watchlists', 'allowedActions', 'actionGates', 'downstream', 'lifecycleDenials',
    ])
    expect(Object.keys(projection.sharedWatchlistDownstreamProof)).toEqual([
        'schemaVersion', 'organizationId', 'tenantId', 'ownerOrganizationId', 'actor', 'inviteLifecycle',
        'watchlistOwnership', 'audit', 'alertBridge', 'caseBridge', 'webhookBridge', 'monitoringWorkflow',
        'analystPortalWorkflow', 'enrichmentProvenance', 'integration', 'blockers',
    ])
    expect(projection.alertGeneration).toEqual(alertGeneration)
    expect(projection.downstreamAuthorization).toEqual(authorization)
    expect(projection.sharedWatchlistDownstreamProof).toEqual(proof)

    expect(authorization.watchlists).toMatchObject({
        activeIds: ['active-a', 'active-z'],
        pausedIds: ['paused'],
        archivedIds: ['archived'],
        activeCount: 2,
        pausedCount: 1,
        archivedCount: 1,
    })
    expect(Object.keys(authorization.watchlists)).toEqual([
        'activeIds', 'pausedIds', 'archivedIds', 'activeCount', 'pausedCount', 'archivedCount', 'states',
    ])
    expect(authorization.watchlists.states).toEqual([
        { watchlistItemId: 'active-a', kind: 'domain', status: 'active' },
        { watchlistItemId: 'active-z', kind: 'domain', status: 'active' },
        { watchlistItemId: 'paused', kind: 'keyword', status: 'paused' },
        { watchlistItemId: 'archived', kind: 'vendor', status: 'archived' },
    ])
    expect(authorization.visibility.allowed).toBe(true)
    expect(authorization.downstream.alertGeneration.canExportActiveTerms).toBe(true)
    expect(alertGeneration.activeWatchlistTerms.map(term => term.watchlistItemId)).toEqual(['active-a', 'active-z'])

    expect(proof.watchlistOwnership).toMatchObject({
        activeIds: authorization.watchlists.activeIds,
        pausedIds: authorization.watchlists.pausedIds,
        archivedIds: authorization.watchlists.archivedIds,
        activeCount: 2,
        pausedCount: 1,
        archivedCount: 1,
        lifecycleStatuses: [
            { watchlistItemId: 'active-a', status: 'active' },
            { watchlistItemId: 'active-z', status: 'active' },
            { watchlistItemId: 'paused', status: 'paused' },
            { watchlistItemId: 'archived', status: 'archived' },
        ],
    })
    expect(Object.keys(proof.watchlistOwnership).slice(0, 6)).toEqual([
        'activeIds', 'pausedIds', 'archivedIds', 'activeCount', 'pausedCount', 'archivedCount',
    ])
    expect(proof.watchlistOwnership.activeIds).not.toBe(authorization.watchlists.activeIds)
    expect(proof.watchlistOwnership.pausedIds).not.toBe(authorization.watchlists.pausedIds)
    expect(proof.watchlistOwnership.archivedIds).not.toBe(authorization.watchlists.archivedIds)
})
