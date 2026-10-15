import { expect, test } from 'bun:test'
import { organizationWatchlistAlertTermsExport } from '../src/utils/organizations.ts'

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
