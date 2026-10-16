import { buildMemberDownstreamReadinessRevocation } from './removalDownstream.ts'
import { buildMemberConsumerAccessRecovery } from './removalRecovery.ts'
import { removedMemberBlockedRoutes } from '../downstreamRoutes.ts'
import type { OrganizationRole } from '#utils/organizations.ts'

type MemberRemovalReceiptInput = {
    organizationId: string
    targetUserId: string
    targetRole: OrganizationRole
    targetRoleBeforeRemoval: OrganizationRole
    revokedInviteIds: string[]
    revokedInviteCount: number
}

export function buildOrganizationMemberRemovalCleanup({
    organizationId,
    targetUserId,
    targetRole,
    targetRoleBeforeRemoval,
    revokedInviteIds,
    revokedInviteCount,
}: MemberRemovalReceiptInput) {
    return {
        schemaVersion: 'organization.member_removal_cleanup.v1',
        organizationId: organizationId,
        tenantId: organizationId,
        targetUserId: targetUserId,
        targetRole: targetRole,
        revokedInviteIds: revokedInviteIds,
        revokedInviteCount: revokedInviteCount,
        revokedInviteStatus: 'revoked' as const,
        staleInviteAcceptanceBlocker: 'member_revoked' as const,
        noOrphanedInviteTokens: true,
        serviceLogAction: 'organization_member_removed' as const,
        consumerAccessRevocation: {
            schemaVersion: 'organization.member_consumer_access_revocation.v1',
            organizationId: organizationId,
            tenantId: organizationId,
            targetUserId: targetUserId,
            targetRole: targetRole,
            revokedInviteIds: revokedInviteIds,
            revokedInviteCount: revokedInviteCount,
            blockedRoutes: [...removedMemberBlockedRoutes],
            blockedConsumerContracts: [
                'organization.watchlist_alert_generation_consumer.v1',
                'organization.watchlist_alert_generation_consumer_denial.v1',
                'organization.case_visibility_consumer.v1',
                'organization.shared_watchlist_readiness_export.v1',
                'organization.webhook_destination_ownership.v1',
                'organization.webhook_destination_access_decision.v1',
                'organization.webhook_alert_delivery_readiness.v1',
            ],
            denialContracts: [
                'organization.access_denial.v1',
                'organization.watchlist_alert_terms_export_denial.v1',
                'organization.alert_case_visibility_denial.v1',
            ],
            blockerCode: 'member_revoked' as const,
            noEnumeration: true,
            noLeakFields: [
                'activeTerms',
                'watchlistScope.alertGeneratorKeys',
                'case.evidence.rawContent',
                'otherOrg.watchlistItemIds',
                'destination.secret',
            ],
            webhookDestinationAccessRevocation: {
                schemaVersion: 'organization.member_webhook_destination_access_revocation.v1',
                organizationId: organizationId,
                tenantId: organizationId,
                targetUserId: targetUserId,
                targetRole: targetRole,
                blockedRoute: 'POST /v1/dwm/webhooks/deliver',
                blockedContracts: [
                    'organization.webhook_destination_ownership.v1',
                    'organization.webhook_destination_access_decision.v1',
                    'organization.webhook_alert_delivery_readiness.v1',
                    'organization.webhook_destination_readiness_bridge.v1',
                    'organization.shared_watchlist_readiness_export.v1',
                ],
                requiredMembershipStatus: 'active',
                removedMemberBlocker: 'member_revoked',
                revokedInviteBlocker: 'member_revoked',
                nonmemberDestinationEnumeration: false,
                noLeakFields: [
                    'destination.secret',
                    'otherOrg.destinationIds',
                    'activeTerms[].term',
                    'case.evidence.rawContent',
                ],
            },
            downstreamReadinessRevocation: buildMemberDownstreamReadinessRevocation({ organizationId, targetUserId, targetRole, revokedInviteIds, revokedInviteCount }),
        },
        consumerAccessRecovery: buildMemberConsumerAccessRecovery({ organizationId, targetUserId, targetRoleBeforeRemoval }),
    }
}
