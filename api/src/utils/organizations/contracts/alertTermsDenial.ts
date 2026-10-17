import type { OrganizationAlertCaseAction } from '../inputTypes.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationVisibilityDecision, OrganizationVisibilityDenyReason } from '../../organizationVisibility.ts'

export type OrganizationWatchlistAlertTermsExportDenial = {
    schemaVersion: 'organization.watchlist_alert_terms_export_denial.v1'
    organizationId: string
    tenantId: string
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    visibility: OrganizationVisibilityDecision
    allowedActions: OrganizationAlertCaseAction[]
    routes: {
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
        alertReadiness: 'GET /api/organizations/:id/alert-readiness'
        listWatchlists: 'GET /api/organizations/:id/watchlists'
    }
    safeFields: string[]
    redactedFields: Array<'activeTerms[]' | 'activeWatchlistTerms[]' | 'alertGeneratorKeys[]' | 'watchlistScope.alertGeneratorKeys'>
    blockerCodes: Array<OrganizationVisibilityDenyReason | 'alert_export_unavailable'>
    nonmemberEnumeration: false
    alertGenerationConsumerDenial: {
        schemaVersion: 'organization.watchlist_alert_generation_consumer_denial.v1'
        organizationId: string
        tenantId: string
        repositoryAdapter: 'organizationWatchlistAlertTermsExport'
        route: 'GET /api/organizations/:id/watchlists/alert-terms'
        member: {
            role: OrganizationRole
            status: 'active'
        }
        canReadSharedWatchlists: true
        canExportAlertTerms: false
        canMutateWatchlists: boolean
        allowedExportRoles: OrganizationRole[]
        readSharedWatchlistRoles: OrganizationRole[]
        mutateWatchlistRoles: Array<'owner' | 'admin' | 'editor'>
        denialReason: OrganizationVisibilityDenyReason | 'alert_export_unavailable'
        safeFields: Array<'organizationId' | 'tenantId' | 'member.role' | 'allowedExportRoles' | 'denialReason' | 'requestId'>
        noLeakFields: Array<'activeTerms[]' | 'activeWatchlistTerms[]' | 'alertGeneratorKeys[]' | 'watchlistScope.alertGeneratorKeys' | 'otherOrg.watchlistItemIds'>
        nonmemberEnumeration: false
        removedMemberDenied: 'member_revoked'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    auditProof: {
        schemaVersion: 'organization.watchlist_alert_terms_denial_audit.v1'
        serviceLogAction: 'organization_watchlist_alert_terms_export_denied'
        requestId: string | null
        requiredMetadataFields: Array<'requestId' | 'role' | 'alertVisibilityPolicy' | 'allowedRoles' | 'denialReason' | 'blockerCodes'>
        redactedFields: Array<'activeTerms[]' | 'activeWatchlistTerms[]' | 'alertGeneratorKeys[]' | 'watchlistScope.alertGeneratorKeys'>
        proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist_alert_terms_export_denied'
    }
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}
