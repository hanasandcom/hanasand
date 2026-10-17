import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationVisibilityDecision } from '../../organizationVisibility.ts'
import type { OrganizationWatchlistAlertTermsExportDenial } from '../contracts/alertTermsDenial.ts'
import type { OrganizationRow } from '../rowTypes.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationAlertCaseRoleActions, roleCanWriteWatchlist } from '../authorization/roleActions.ts'

export function organizationWatchlistAlertTermsExportDenial(input: {
    organizationId: string
    tenantId?: string | null
    member: {
        userId: string
        role: OrganizationRole
    }
    visibility: OrganizationVisibilityDecision
    requestId?: string | null
}): OrganizationWatchlistAlertTermsExportDenial {
    const redactedFields: OrganizationWatchlistAlertTermsExportDenial['redactedFields'] = [
        'activeTerms[]',
        'activeWatchlistTerms[]',
        'alertGeneratorKeys[]',
        'watchlistScope.alertGeneratorKeys',
    ]
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export_denial.v1',
        ...organizationTenantIdentity(input.organizationId, input.tenantId ?? input.organizationId),
        member: {
            userId: input.member.userId,
            role: input.member.role,
            status: 'active',
        },
        visibility: input.visibility,
        allowedActions: organizationAlertCaseRoleActions(input.member.role),
        routes: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            listWatchlists: 'GET /api/organizations/:id/watchlists',
        },
        safeFields: [
            'organizationId',
            'tenantId',
            'member.role',
            'visibility.alertVisibilityPolicy',
            'visibility.allowedRoles',
            'visibility.reason',
            'allowedActions',
            'routes',
            'blockerCodes',
        ],
        redactedFields,
        blockerCodes: [input.visibility.reason ?? 'alert_export_unavailable'],
        nonmemberEnumeration: false,
        alertGenerationConsumerDenial: {
            schemaVersion: 'organization.watchlist_alert_generation_consumer_denial.v1',
            ...organizationTenantIdentity(input.organizationId, input.tenantId ?? input.organizationId),
            repositoryAdapter: 'organizationWatchlistAlertTermsExport',
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            member: {
                role: input.member.role,
                status: 'active',
            },
            canReadSharedWatchlists: true,
            canExportAlertTerms: false,
            canMutateWatchlists: roleCanWriteWatchlist(input.member.role),
            allowedExportRoles: input.visibility.allowedRoles,
            readSharedWatchlistRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
            mutateWatchlistRoles: ['owner', 'admin', 'editor'],
            denialReason: input.visibility.reason ?? 'alert_export_unavailable',
            safeFields: [
                'organizationId',
                'tenantId',
                'member.role',
                'allowedExportRoles',
                'denialReason',
                'requestId',
            ],
            noLeakFields: [
                'activeTerms[]',
                'activeWatchlistTerms[]',
                'alertGeneratorKeys[]',
                'watchlistScope.alertGeneratorKeys',
                'otherOrg.watchlistItemIds',
            ],
            nonmemberEnumeration: false,
            removedMemberDenied: 'member_revoked',
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        auditProof: {
            schemaVersion: 'organization.watchlist_alert_terms_denial_audit.v1',
            serviceLogAction: 'organization_watchlist_alert_terms_export_denied',
            requestId: input.requestId ?? null,
            requiredMetadataFields: [
                'requestId',
                'role',
                'alertVisibilityPolicy',
                'allowedRoles',
                'denialReason',
                'blockerCodes',
            ],
            redactedFields,
            proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist_alert_terms_export_denied',
        },
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
}

export function organizationWatchlistOwnerContext(input: {
    organization: Pick<OrganizationRow, 'id' | 'role'>
    watchlistItemId: string
    actorId: string
    visibility: OrganizationVisibilityDecision
}) {
    return {
        schemaVersion: 'organization.watchlist_owner_context.v1' as const,
        organizationId: input.organization.id,
        tenantId: input.organization.id,
        ownerOrganizationId: input.organization.id,
        watchlistItemId: input.watchlistItemId,
        watchlistId: input.watchlistItemId,
        actorId: input.actorId,
        actorRole: input.organization.role ?? 'viewer',
        visibilityPolicy: input.visibility.alertVisibilityPolicy,
        allowedViewerRoles: input.visibility.allowedRoles,
        sourceFamily: 'organization_watchlist' as const,
        route: 'organization_watchlist' as const,
        alertBridgeFields: [
            'organizationId',
            'tenantId',
            'ownerOrganizationId',
            'watchlistItemId',
            'watchlistId',
            'workflowContext.alertGenerationRefs',
            'workflowContext.alertGeneratorKeys',
        ],
        webhookBridgeFields: [
            'organizationId',
            'tenantId',
            'ownerOrganizationId',
            'watchlistItemId',
            'destination.org_id',
            'webhookDestinationIds[]',
        ],
        crossTenantCollisionAllowed: false,
        nonmemberEnumeration: false,
    }
}
