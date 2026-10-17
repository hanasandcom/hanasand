import { type OrganizationRole } from '../../organizationRoles.ts'
import { organizationVisibilityDecision } from '../../organizationVisibility.ts'
import type { OrganizationAlertCaseAction } from '../inputTypes.ts'
import type { OrganizationDownstreamAuthorizationExport } from '../contracts/downstreamAuthorization.ts'
import type { OrganizationRow, OrganizationWatchlistRow } from '../rowTypes.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from '../contracts/alertBridge.ts'
import type { OrganizationWatchlistLifecycleProjection } from './lifecycleProjection.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { normalizeOrganizationStatus } from '../normalization/organizationValues.ts'
import { organizationWatchlistLifecycleProjection } from './lifecycleProjection.ts'
import { organizationAlertCaseRoleActions, organizationAlertCaseRoleActionContract } from '../authorization/roleActions.ts'

export function organizationDownstreamAuthorizationExport(
    organization: Pick<OrganizationRow, 'id' | 'status' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>,
    items: OrganizationWatchlistRow[],
    member: { userId: string, role: OrganizationRole }
): OrganizationDownstreamAuthorizationExport {
    return organizationDownstreamAuthorizationExportFromProjection(
        organization,
        organizationWatchlistLifecycleProjection(items),
        member
    )
}

export function organizationDownstreamAuthorizationExportFromProjection(
    organization: Pick<OrganizationRow, 'id' | 'status' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>,
    watchlistProjection: OrganizationWatchlistLifecycleProjection,
    member: { userId: string, role: OrganizationRole }
): OrganizationDownstreamAuthorizationExport {
    const organizationStatus = normalizeOrganizationStatus(organization.status)
    const visibility = organizationVisibilityDecision({
        role: member.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy ?? 'members',
    })
    const states: OrganizationDownstreamAuthorizationExport['watchlists']['states'] = []
    const activeIds: string[] = []
    const pausedIds: string[] = []
    const archivedIds: string[] = []
    for (const term of watchlistProjection.terms) {
        states.push({ watchlistItemId: term.watchlistItemId, kind: term.kind, status: term.status })
        if (term.status === 'active') activeIds.push(term.watchlistItemId)
        else if (term.status === 'paused') pausedIds.push(term.watchlistItemId)
        else archivedIds.push(term.watchlistItemId)
    }
    const allowedActions = organizationAlertCaseRoleActions(member.role)
    const roleContract = organizationAlertCaseRoleActionContract(member)
    const blockerCodes: OrganizationWatchlistAlertBridgeBlockerCode[] = []
    if (organizationStatus !== 'active') blockerCodes.push(organizationStatus === 'archived' ? 'org_archived' : 'org_deleted')
    if (!activeIds.length) blockerCodes.push('no_active_terms', 'alert_export_unavailable')
    if (pausedIds.length) blockerCodes.push('watchlist_paused')
    if (archivedIds.length) blockerCodes.push('watchlist_archived')
    const canExportActiveTerms = organizationStatus === 'active' && visibility.allowed && activeIds.length > 0
    const defaultWebhookPolicy = organization.default_webhook_policy ?? 'active_destinations'

    return {
        schemaVersion: 'organization.downstream_authorization_export.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        organizationLifecycleState: organizationStatus,
        member: {
            userId: member.userId,
            role: member.role,
            status: 'active',
        },
        visibility,
        watchlists: {
            activeIds,
            pausedIds,
            archivedIds,
            activeCount: activeIds.length,
            pausedCount: pausedIds.length,
            archivedCount: archivedIds.length,
            states,
        },
        allowedActions,
        actionGates: Object.fromEntries(
            Object.entries(roleContract.roleGates).map(([action, allowedRoles]) => [
                action,
                {
                    allowed: allowedActions.includes(action as OrganizationAlertCaseAction),
                    allowedRoles,
                    denialReason: allowedActions.includes(action as OrganizationAlertCaseAction) ? null : 'role_not_allowed',
                },
            ])
        ) as OrganizationDownstreamAuthorizationExport['actionGates'],
        downstream: {
            alertGeneration: {
                canExportActiveTerms,
                excludedStatuses: ['paused', 'archived'],
                blockerCodes,
            },
            webhook: {
                defaultPolicy: defaultWebhookPolicy,
                canUseDefaultDestinations: canExportActiveTerms && defaultWebhookPolicy === 'active_destinations',
                denialReason: defaultWebhookPolicy === 'disabled' ? 'alert_bridge_unavailable' : null,
            },
            helpdesk: {
                mode: 'redacted_summary_only',
                supportOnlyDenialReason: 'support_only_access',
                safeFields: ['organizationId', 'tenantId', 'member.role', 'watchlists.activeCount', 'watchlists.pausedCount', 'watchlists.archivedCount', 'visibility.allowedRoles'],
            },
            dashboard: {
                safeFields: ['organizationId', 'tenantId', 'organizationLifecycleState', 'member.role', 'allowedActions', 'watchlists.states', 'downstream.alertGeneration.blockerCodes'],
                nonmemberEnumeration: false,
            },
        },
        lifecycleDenials: {
            inactiveOrganization: 'no_active_org',
            archivedOrganization: 'org_archived',
            removedMember: 'member_revoked',
            revokedMember: 'member_revoked',
            deactivatedMember: 'revoked_member_denied',
            expiredInvite: 'invite_expired',
            revokedInvite: 'member_revoked',
            pausedWatchlist: 'watchlist_paused',
            archivedWatchlist: 'watchlist_archived',
            noActiveTerms: 'no_active_terms',
            nonmember: 'nonmember_denied',
            roleNotAllowed: 'role_not_allowed',
        },
    }
}
