import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationAlertVisibilityPolicy } from '../../organizationVisibility.ts'
import type { OrganizationAlertCaseAction, OrganizationAlertCaseRole, WatchlistKind } from '../inputTypes.ts'

export type OrganizationWatchlistAlertBridgeBlockerCode =
    | 'no_active_org'
    | 'no_active_admin'
    | 'org_archived'
    | 'org_deleted'
    | 'invite_expired'
    | 'member_revoked'
    | 'watchlist_archived'
    | 'watchlist_paused'
    | 'no_active_terms'
    | 'paused_archived_only'
    | 'cleanup_required'
    | 'alert_bridge_unavailable'
    | 'alert_export_unavailable'
    | 'case_route_unavailable'
    | 'support_redaction_required'
    | 'no_active_watchlist_terms'
    | 'paused_watchlist_excluded'
    | 'archived_watchlist_excluded'
    | 'missing_org_tenant'
    | 'revoked_member_denied'
    | 'no_alert_ref'
    | 'no_case_route'
    | 'support_only_access'
    | 'nonmember_denied'
    | 'role_not_allowed'

export type OrganizationWatchlistAlertBridgeBlocker = {
    code: OrganizationWatchlistAlertBridgeBlockerCode
    severity: 'blocker' | 'notice'
    message: string
    count?: number
}

export type OrganizationWatchlistAlertBridgeContract = {
    schemaVersion: 'organization.watchlist_alert_bridge_contract.v1'
    recommendedDownstreamRoute: 'organization_watchlist'
    memberProvenance: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    supportAccess: {
        mode: 'support_contract_only'
        blockerCode: 'support_only_access'
        message: string
    }
    supportVisibility: {
        mode: 'redacted_summary_only'
        contract: 'admin_support'
        safeFields: string[]
        redactedFields: string[]
        message: string
    }
    deniedAccess: {
        nonmember: 'nonmember_denied'
        revokedMember: 'revoked_member_denied'
    }
    caseRouteExpectation: {
        route: 'organization_watchlist'
        pathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        queryFields: ['organizationId', 'watchlistItemId']
        blockerCode: 'no_case_route'
    }
    redactedSummary: {
        schemaVersion: 'organization.watchlist_alert_bridge_redacted_summary.v1'
        organizationId: string
        tenantId: string
        activeTermCount: number
        termFamilies: WatchlistKind[]
        pausedCount: number
        archivedCount: number
        cleanupRequired: boolean
        visibilityPolicy: OrganizationAlertVisibilityPolicy
        allowedViewerRoles: OrganizationRole[]
        containsRawTerms: false
    }
    lifecycleReadiness: {
        schemaVersion: 'organization.watchlist_lifecycle_readiness.v1'
        organization: {
            status: 'active'
            deletedBlocker: 'org_deleted'
        }
        member: {
            status: 'active'
            revokedBlocker: 'member_revoked'
        }
        invites: {
            expiredInviteBlocker: 'invite_expired'
            revokedInviteBlocker: 'member_revoked'
        }
        watchlists: {
            activeTermCount: number
            pausedCount: number
            archivedCount: number
            cleanupRequired: boolean
            cleanupIdempotent: true
            pausedBlocker: 'watchlist_paused'
            archivedBlocker: 'watchlist_archived'
            noActiveTermsBlocker: 'no_active_terms'
            cleanupRequiredBlocker: 'cleanup_required'
        }
        alertReplay: {
            status: 'ready' | 'blocked'
            unavailableBlocker: 'alert_bridge_unavailable'
        }
        caseRoute: {
            status: 'expected'
            unavailableBlocker: 'case_route_unavailable'
        }
        typedBlockers: OrganizationWatchlistAlertBridgeBlocker[]
    }
    alertCaseProof: {
        schemaVersion: 'organization.watchlist_alert_case_proof.v1'
        organizationId: string
        tenantId: string
        readyForReplay: boolean
        activeAdminCount: number
        activeTermCount: number
        replayRoute: 'organization_watchlist'
        expectedAlertFields: string[]
        expectedCaseFields: string[]
        expectedSupportFields: string[]
        memberVisibility: {
            mode: 'member_scoped_export'
            userId: string
            role: OrganizationRole
            status: 'active'
            nonmemberEnumeration: false
            revokedMemberDenial: 'member_revoked'
        }
        roleActionContract: {
            schemaVersion: 'organization.alert_case_role_actions.v1'
            actor: {
                userId: string
                role: OrganizationRole
                status: 'active'
                allowedActions: OrganizationAlertCaseAction[]
            }
            roleGates: Record<OrganizationAlertCaseAction, OrganizationAlertCaseRole[]>
            lifecycleDenials: {
                nonmember: 'nonmember_denied'
                revokedMember: 'member_revoked'
                expiredInvite: 'invite_expired'
                pausedWatchlist: 'watchlist_paused'
                archivedWatchlist: 'watchlist_archived'
                supportOnlyAccess: 'support_only_access'
            }
        }
        supportRedaction: {
            mode: 'redacted_summary_only'
            required: true
            blockerCode: 'support_redaction_required'
        }
        cleanupLifecycle: {
            cleanupRequired: boolean
            cleanupIdempotent: true
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup'
            pausedExcludedCount: number
            archivedExcludedCount: number
            cleanupRequiredBlocker: 'cleanup_required'
        }
        typedBlockers: OrganizationWatchlistAlertBridgeBlocker[]
    }
    requiredFields: string[]
    alertGeneratorKeyExpectation: 'alertGenerationRef.dedupe.key'
    typedBlockers: OrganizationWatchlistAlertBridgeBlocker[]
    blockerCatalog: OrganizationWatchlistAlertBridgeBlockerCode[]
}
