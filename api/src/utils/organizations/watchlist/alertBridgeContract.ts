import { organizationTenantIdentity } from '../identity.ts'
import { organizationAlertCaseRoleActionContract } from '../authorization/roleActions.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationWatchlistAlertBridgeBlocker } from '../contracts/alertBridge.ts'
import type { OrganizationWatchlistAlertGenerationContract, OrganizationWatchlistAlertTermsExport } from '../types.ts'

type Input = {
    organizationId: string
    member: { userId: string, role: OrganizationRole }
    alertGeneration: OrganizationWatchlistAlertGenerationContract
    supportAccess: OrganizationWatchlistAlertTermsExport['alertBridgeContract']['supportAccess']
    supportVisibility: OrganizationWatchlistAlertTermsExport['alertBridgeContract']['supportVisibility']
    redactedSummary: OrganizationWatchlistAlertTermsExport['alertBridgeContract']['redactedSummary']
    lifecycleTypedBlockers: OrganizationWatchlistAlertBridgeBlocker[]
    activeTerms: OrganizationWatchlistAlertGenerationContract['activeWatchlistTerms']
    activeAdminCount: number
    cleanupRequired: boolean
    pausedCount: number
    archivedCount: number
    alertCaseProofBlockers: OrganizationWatchlistAlertBridgeBlocker[]
    typedBlockers: OrganizationWatchlistAlertBridgeBlocker[]
}

export function buildOrganizationAlertBridgeContract(input: Input): OrganizationWatchlistAlertTermsExport['alertBridgeContract'] {
    const { member } = input
    const activeMemberActor = {
        userId: member.userId,
        role: member.role,
        status: 'active' as const,
    }
    return {
        schemaVersion: 'organization.watchlist_alert_bridge_contract.v1',
        recommendedDownstreamRoute: 'organization_watchlist',
        memberProvenance: activeMemberActor,
        supportAccess: input.supportAccess,
        supportVisibility: input.supportVisibility,
        deniedAccess: {
            nonmember: 'nonmember_denied',
            revokedMember: 'revoked_member_denied',
        },
        caseRouteExpectation: {
            route: 'organization_watchlist',
            pathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
            queryFields: ['organizationId', 'watchlistItemId'],
            blockerCode: 'no_case_route',
        },
        redactedSummary: input.redactedSummary,
        lifecycleReadiness: {
            schemaVersion: 'organization.watchlist_lifecycle_readiness.v1',
            organization: {
                status: 'active',
                deletedBlocker: 'org_deleted',
            },
            member: {
                status: 'active',
                revokedBlocker: 'member_revoked',
            },
            invites: {
                expiredInviteBlocker: 'invite_expired',
                revokedInviteBlocker: 'member_revoked',
            },
            watchlists: {
                activeTermCount: input.activeTerms.length,
                pausedCount: input.pausedCount,
                archivedCount: input.archivedCount,
                cleanupRequired: input.cleanupRequired,
                cleanupIdempotent: true,
                pausedBlocker: 'watchlist_paused',
                archivedBlocker: 'watchlist_archived',
                noActiveTermsBlocker: 'no_active_terms',
                cleanupRequiredBlocker: 'cleanup_required',
            },
            alertReplay: {
                status: input.activeTerms.length > 0 ? 'ready' : 'blocked',
                unavailableBlocker: 'alert_bridge_unavailable',
            },
            caseRoute: {
                status: 'expected',
                unavailableBlocker: 'case_route_unavailable',
            },
            typedBlockers: input.lifecycleTypedBlockers,
        },
        alertCaseProof: {
            schemaVersion: 'organization.watchlist_alert_case_proof.v1',
            ...organizationTenantIdentity(input.organizationId, input.organizationId),
            readyForReplay: !input.alertCaseProofBlockers.some(blocker => blocker.severity === 'blocker'),
            activeAdminCount: input.activeAdminCount,
            activeTermCount: input.activeTerms.length,
            replayRoute: 'organization_watchlist',
            expectedAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemId',
                'matchedTerm.termFamily',
                'alertGeneratorKey',
                'alertGenerationRef.dedupe.key',
                'alertGenerationRef.lifecycle.requestId',
            ],
            expectedCaseFields: [
                'route',
                'casePath',
                'organizationId',
                'watchlistItemId',
                'allowedViewerRoles',
                'caseRouteExpectation.pathTemplate',
            ],
            expectedSupportFields: [
                'redactedSummary',
                'supportVisibility.mode',
                'supportVisibility.safeFields',
                'supportVisibility.redactedFields',
                'supportAccess.blockerCode',
            ],
            memberVisibility: {
                mode: 'member_scoped_export',
                ...activeMemberActor,
                nonmemberEnumeration: false,
                revokedMemberDenial: 'member_revoked',
            },
            roleActionContract: organizationAlertCaseRoleActionContract(member),
            supportRedaction: {
                mode: 'redacted_summary_only',
                required: true,
                blockerCode: 'support_redaction_required',
            },
            cleanupLifecycle: {
                cleanupRequired: input.cleanupRequired,
                cleanupIdempotent: true,
                cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
                pausedExcludedCount: input.pausedCount,
                archivedExcludedCount: input.archivedCount,
                cleanupRequiredBlocker: 'cleanup_required',
            },
            typedBlockers: input.alertCaseProofBlockers,
        },
        requiredFields: [
            'organizationId',
            'tenantId',
            'member.userId',
            'member.role',
            'activeTerms[].watchlistItemId',
            'activeTerms[].itemId',
            'activeTerms[].status',
            'activeTerms[].termFamily',
            'activeTerms[].term',
            'activeTerms[].alertGenerationRef',
            'activeTerms[].alertGenerationRef.dedupe.key',
            'activeTerms[].ownerContext',
            'activeTerms[].alertGeneratorKey',
            'alertBridgeContract.caseRouteExpectation.pathTemplate',
            'alertBridgeContract.redactedSummary',
            'alertBridgeContract.lifecycleReadiness',
            'alertBridgeContract.alertCaseProof',
        ],
        alertGeneratorKeyExpectation: 'alertGenerationRef.dedupe.key',
        typedBlockers: input.typedBlockers,
        blockerCatalog: [
            'no_active_org',
            'no_active_admin',
            'org_archived',
            'org_deleted',
            'invite_expired',
            'member_revoked',
            'watchlist_archived',
            'watchlist_paused',
            'no_active_terms',
            'paused_archived_only',
            'cleanup_required',
            'alert_bridge_unavailable',
            'alert_export_unavailable',
            'case_route_unavailable',
            'support_redaction_required',
            'no_active_watchlist_terms',
            'paused_watchlist_excluded',
            'archived_watchlist_excluded',
            'missing_org_tenant',
            'revoked_member_denied',
            'no_alert_ref',
            'no_case_route',
            'support_only_access',
            'nonmember_denied',
            'role_not_allowed',
        ],
    }
}
