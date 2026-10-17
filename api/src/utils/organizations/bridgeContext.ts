import type { OrganizationDefaultWebhookPolicy } from './inputTypes.ts'
import type { OrganizationRole } from '../organizationRoles.ts'
import type { OrganizationRow } from './rowTypes.ts'
import type { OrganizationVisibilityDenyReason } from '../organizationVisibility.ts'
import { allowedOrganizationVisibilityRoles, organizationVisibilityDecision, type OrganizationAlertVisibilityPolicy } from '../organizationVisibility.ts'

export type OrganizationReadinessStatus = 'ready' | 'needs_watchlist'

export type OrganizationBridgeContext = {
    id: string
    name: string
    slug?: string
    defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
    alertVisibilityPolicy: OrganizationAlertVisibilityPolicy
    memberCount: number
    activeMemberCount: number
    ownerCount: number
    allowedViewerRoles: OrganizationRole[]
    removedMemberDenialReason: OrganizationVisibilityDenyReason
    deactivatedMemberDenialReason: OrganizationVisibilityDenyReason
    pendingInviteCount: number
    sharedWatchlistCount: number
    readinessStatus: OrganizationReadinessStatus
}

export type OrganizationBridgeContextFields = Pick<OrganizationBridgeContext,
    'defaultWebhookPolicy' | 'alertVisibilityPolicy' | 'memberCount' | 'activeMemberCount' | 'ownerCount'
    | 'allowedViewerRoles' | 'removedMemberDenialReason' | 'deactivatedMemberDenialReason'
    | 'pendingInviteCount' | 'sharedWatchlistCount' | 'readinessStatus'
>

export function organizationBridgeContextFields(context: OrganizationBridgeContext): OrganizationBridgeContextFields {
    return {
        defaultWebhookPolicy: context.defaultWebhookPolicy,
        alertVisibilityPolicy: context.alertVisibilityPolicy,
        memberCount: context.memberCount,
        activeMemberCount: context.activeMemberCount,
        ownerCount: context.ownerCount,
        allowedViewerRoles: context.allowedViewerRoles,
        removedMemberDenialReason: context.removedMemberDenialReason,
        deactivatedMemberDenialReason: context.deactivatedMemberDenialReason,
        pendingInviteCount: context.pendingInviteCount,
        sharedWatchlistCount: context.sharedWatchlistCount,
        readinessStatus: context.readinessStatus,
    }
}

export function buildOrganizationBridgeContext(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>
): OrganizationBridgeContext {
    const sharedWatchlistCount = Number(organization.shared_watchlist_count ?? 0)
    const alertVisibilityPolicy = organization.alert_visibility_policy ?? 'members'
    return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        defaultWebhookPolicy: organization.default_webhook_policy ?? 'active_destinations',
        alertVisibilityPolicy,
        memberCount: Number(organization.member_count ?? 0),
        activeMemberCount: Number(organization.member_count ?? 0),
        ownerCount: Number(organization.owner_count ?? 0),
        allowedViewerRoles: allowedOrganizationVisibilityRoles(alertVisibilityPolicy),
        removedMemberDenialReason: organizationVisibilityDecision({
            role: 'member',
            status: 'removed',
            alertVisibilityPolicy,
        }).reason ?? 'member_removed',
        deactivatedMemberDenialReason: organizationVisibilityDecision({
            role: 'member',
            status: 'active',
            userActive: false,
            alertVisibilityPolicy,
        }).reason ?? 'member_deactivated',
        pendingInviteCount: Number(organization.pending_invite_count ?? 0),
        sharedWatchlistCount,
        readinessStatus: sharedWatchlistCount > 0 ? 'ready' : 'needs_watchlist',
    }
}
