import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationVisibilityDecision } from '../../organizationVisibility.ts'
import type {
    OrganizationAlertCaseAction,
    OrganizationAlertCaseRole,
    OrganizationDefaultWebhookPolicy,
    OrganizationLifecycleStatus,
    OrganizationWatchlistStatus,
    WatchlistKind,
} from '../inputTypes.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from './alertBridge.ts'

export type OrganizationDownstreamAuthorizationExport = {
    schemaVersion: 'organization.downstream_authorization_export.v1'
    organizationId: string
    tenantId: string
    organizationLifecycleState: OrganizationLifecycleStatus
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    visibility: OrganizationVisibilityDecision
    watchlists: {
        activeIds: string[]
        pausedIds: string[]
        archivedIds: string[]
        activeCount: number
        pausedCount: number
        archivedCount: number
        states: Array<{
            watchlistItemId: string
            kind: WatchlistKind
            status: OrganizationWatchlistStatus
        }>
    }
    allowedActions: OrganizationAlertCaseAction[]
    actionGates: Record<OrganizationAlertCaseAction, {
        allowed: boolean
        allowedRoles: OrganizationAlertCaseRole[]
        denialReason: OrganizationWatchlistAlertBridgeBlockerCode | null
    }>
    downstream: {
        alertGeneration: {
            canExportActiveTerms: boolean
            excludedStatuses: OrganizationWatchlistStatus[]
            blockerCodes: OrganizationWatchlistAlertBridgeBlockerCode[]
        }
        webhook: {
            defaultPolicy: OrganizationDefaultWebhookPolicy
            canUseDefaultDestinations: boolean
            denialReason: OrganizationWatchlistAlertBridgeBlockerCode | null
        }
        helpdesk: {
            mode: 'redacted_summary_only'
            supportOnlyDenialReason: 'support_only_access'
            safeFields: string[]
        }
        dashboard: {
            safeFields: string[]
            nonmemberEnumeration: false
        }
    }
    lifecycleDenials: {
        inactiveOrganization: 'no_active_org'
        archivedOrganization: 'org_archived'
        removedMember: 'member_revoked'
        revokedMember: 'member_revoked'
        deactivatedMember: 'revoked_member_denied'
        expiredInvite: 'invite_expired'
        revokedInvite: 'member_revoked'
        pausedWatchlist: 'watchlist_paused'
        archivedWatchlist: 'watchlist_archived'
        noActiveTerms: 'no_active_terms'
        nonmember: 'nonmember_denied'
        roleNotAllowed: 'role_not_allowed'
    }
}
