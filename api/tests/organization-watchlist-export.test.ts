import { expect, test } from 'bun:test'
import {
    organizationVisibilityDecision,
    organizationWatchlistOwnerContext,
    organizationWatchlistAlertTermsExport,
    organizationWatchlistAlertTermsExportDenial,
} from '../src/utils/organizations.ts'

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

test('watchlist owner context keeps a stable shared response contract', () => {
    const memberOrganization = { ...organization, role: 'reader' as const }
    const visibility = organizationVisibilityDecision({
        role: 'reader', status: 'active', userActive: true, alertVisibilityPolicy: 'members',
    })
    const context = organizationWatchlistOwnerContext({
        organization: memberOrganization,
        watchlistItemId: 'watchlist-1',
        actorId: 'member-1',
        visibility,
    })

    expect(Object.keys(context)).toEqual([
        'schemaVersion', 'organizationId', 'tenantId', 'ownerOrganizationId', 'watchlistItemId', 'watchlistId',
        'actorId', 'actorRole', 'visibilityPolicy', 'allowedViewerRoles', 'sourceFamily', 'route',
        'alertBridgeFields', 'webhookBridgeFields', 'crossTenantCollisionAllowed', 'nonmemberEnumeration',
    ])
    expect(context).toEqual({
        schemaVersion: 'organization.watchlist_owner_context.v1',
        organizationId: 'org-1',
        tenantId: 'org-1',
        ownerOrganizationId: 'org-1',
        watchlistItemId: 'watchlist-1',
        watchlistId: 'watchlist-1',
        actorId: 'member-1',
        actorRole: 'reader',
        visibilityPolicy: 'members',
        allowedViewerRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        sourceFamily: 'organization_watchlist',
        route: 'organization_watchlist',
        alertBridgeFields: [
            'organizationId', 'tenantId', 'ownerOrganizationId', 'watchlistItemId', 'watchlistId',
            'workflowContext.alertGenerationRefs', 'workflowContext.alertGeneratorKeys',
        ],
        webhookBridgeFields: [
            'organizationId', 'tenantId', 'ownerOrganizationId', 'watchlistItemId',
            'destination.org_id', 'webhookDestinationIds[]',
        ],
        crossTenantCollisionAllowed: false,
        nonmemberEnumeration: false,
    })
})

test('alert term export preserves shared per-term projections and excludes inactive terms', () => {
    const result = organizationWatchlistAlertTermsExport(organization, [
        watchlistItem({ id: 'active-1', kind: 'domain', value: 'example.com', status: 'active' }),
        watchlistItem({ id: 'paused-1', kind: 'keyword', value: 'launch plan', status: 'paused' }),
        watchlistItem({ id: 'archived-1', kind: 'vendor', value: 'Acme', status: 'archived', archivedAt: '2026-02-01T00:00:00.000Z' }),
    ], { userId: 'owner-1', role: 'owner' })

    const deliveryMatch = result.webhookDestinationAccessDecision.deliveryConsumerReceipt.watchlistMatches[0]
    const matchingInput = result.alertGenerationConsumer.matchingInputReceipt.terms[0]
    const expectedProjection = {
        watchedEntity: {
            type: 'domain',
            value: 'example.com',
            normalizedValue: 'example.com',
        },
        actorRef: {
            userId: 'owner-1',
            role: 'owner',
            source: 'organization_member',
        },
        sourceRefs: {
            sourceFamily: 'organization_watchlist',
            exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
            caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility',
        },
    }

    expect(result.activeTerms.map(term => term.watchlistItemId)).toEqual(['active-1'])
    expect(result.excluded).toEqual({ pausedCount: 1, archivedCount: 1, inactiveCount: 2 })
    expect(Object.keys(deliveryMatch)).toEqual([
        'organizationId', 'tenantId', 'watchlistId', 'watchlistItemId', 'watchedEntity', 'matchReason',
        'actorRef', 'sourceRefs', 'provenanceHash', 'workflowStatus', 'destinationReadiness',
    ])
    expect(deliveryMatch).toMatchObject({
        organizationId: 'org-1',
        tenantId: 'org-1',
        watchlistId: 'active-1',
        watchlistItemId: 'active-1',
        ...expectedProjection,
        matchReason: { kind: 'shared_watchlist_term', code: 'organization_watchlist_term_match' },
        workflowStatus: 'blocked',
        destinationReadiness: {
            destinationDeliveryReady: false,
            dryRunReady: true,
            selectedDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            blockerReason: 'watchlist_paused',
        },
    })
    expect({
        watchedEntity: deliveryMatch.watchedEntity,
        actorRef: deliveryMatch.actorRef,
        sourceRefs: deliveryMatch.sourceRefs,
    }).toEqual(expectedProjection)
    expect(Object.keys(deliveryMatch.watchedEntity)).toEqual(['type', 'value', 'normalizedValue'])
    expect(Object.keys(deliveryMatch.actorRef)).toEqual(['userId', 'role', 'source'])
    expect(Object.keys(deliveryMatch.sourceRefs)).toEqual(['sourceFamily', 'exportRoute', 'caseVisibilityRoute'])
    expect(Object.keys(matchingInput)).toEqual([
        'organizationId', 'tenantId', 'watchlistId', 'watchlistItemId', 'termFamily', 'watchedEntity',
        'matchReason', 'actorRef', 'sourceRefs', 'normalizedTerm', 'alertGeneratorKey', 'provenanceHash',
        'status', 'workflowReadiness', 'destinationReadiness', 'provenance', 'alertGenerationRef',
    ])
    expect(matchingInput).toMatchObject({
        organizationId: 'org-1',
        tenantId: 'org-1',
        watchlistId: 'active-1',
        watchlistItemId: 'active-1',
        termFamily: 'domain',
        ...expectedProjection,
        matchReason: {
            kind: 'shared_watchlist_term',
            code: 'organization_watchlist_term_match',
            field: 'watchedEntity.normalizedValue',
        },
        normalizedTerm: 'example.com',
        status: 'active',
    })
    expect({
        watchedEntity: matchingInput.watchedEntity,
        actorRef: matchingInput.actorRef,
        sourceRefs: matchingInput.sourceRefs,
    }).toEqual(expectedProjection)
    expect(Object.keys(matchingInput.watchedEntity)).toEqual(['type', 'value', 'normalizedValue'])
    expect(Object.keys(matchingInput.actorRef)).toEqual(['userId', 'role', 'source'])
    expect(Object.keys(matchingInput.sourceRefs)).toEqual(['sourceFamily', 'exportRoute', 'caseVisibilityRoute'])
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
