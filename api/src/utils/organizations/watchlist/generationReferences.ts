import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationWatchlistAlertGenerationRef, OrganizationWatchlistTerm } from '../contracts/alertGeneration.ts'
import type { OrganizationWatchlistAlertTermsExport } from '../contracts/watchlistExport.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { cleanText } from '../normalization/text.ts'

export function organizationWatchlistAlertGenerationRef(term: OrganizationWatchlistTerm): OrganizationWatchlistAlertGenerationRef {
    const normalizedTerm = cleanText(term.term).toLowerCase()
    const key = `org:${term.organizationId}:watchlist:${term.watchlistItemId}:${term.termFamily}:${normalizedTerm}`
    return {
        schemaVersion: 'organization.watchlist_alert_generation_ref.v1',
        source: 'organization_shared_watchlist',
        ...organizationTenantIdentity(term.organizationId, term.tenantId),
        ownerOrganizationId: term.organizationId,
        watchlistId: term.watchlistItemId,
        watchlistItemId: term.watchlistItemId,
        itemId: term.itemId,
        termFamily: term.termFamily,
        category: term.category,
        term: term.term,
        normalizedTerm,
        status: 'active',
        enabled: true,
        disabledReason: null,
        lifecycle: {
            status: 'active',
            enabled: true,
            disabledReason: null,
            reason: term.lifecycleReason,
            requestId: term.lifecycleRequestId,
            createdBy: term.createdBy,
            updatedBy: term.updatedBy,
        },
        dedupe: {
            scope: 'organization_watchlist_term',
            key,
            parts: {
                ...organizationTenantIdentity(term.organizationId, term.tenantId),
                watchlistItemId: term.watchlistItemId,
                termFamily: term.termFamily,
                normalizedTerm,
            },
        },
    }
}

export function organizationWatchlistMatchProjection(
    term: OrganizationWatchlistAlertTermsExport['activeTerms'][number],
    member: { userId: string, role: OrganizationRole }
) {
    return {
        watchedEntity: {
            type: term.termFamily,
            value: term.term,
            normalizedValue: term.alertGenerationRef.normalizedTerm,
        },
        actorRef: {
            userId: member.userId,
            role: member.role,
            source: 'organization_member' as const,
        },
        sourceRefs: {
            sourceFamily: 'organization_watchlist' as const,
            exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms' as const,
            caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility' as const,
        },
    }
}

export function organizationWatchlistMatchProvenanceHash(term: OrganizationWatchlistTerm): string {
    const input = [
        term.organizationId,
        term.tenantId,
        term.watchlistItemId,
        term.termFamily,
        cleanText(term.term).toLowerCase(),
        term.createdBy,
        term.lifecycleRequestId ?? '',
    ].join('|')
    let hash = 2166136261
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return `orgprov_${(hash >>> 0).toString(16).padStart(8, '0')}`
}
