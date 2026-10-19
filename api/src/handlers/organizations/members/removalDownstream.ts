import { organizationAccessDownstreamRoutes } from '../downstreamRoutes.ts'
import type { OrganizationRole } from '#utils/organizations.ts'

type Input = { organizationId: string; targetUserId: string; targetRole: OrganizationRole; revokedInviteIds: string[]; revokedInviteCount: number }

export function buildMemberDownstreamReadinessRevocation({ organizationId, targetUserId, targetRole, revokedInviteIds, revokedInviteCount }: Input) {
    return {
        schemaVersion: 'organization.member_downstream_readiness_revocation.v1',
        organizationId: organizationId,
        tenantId: organizationId,
        targetUserId: targetUserId,
        targetRole: targetRole,
        membershipStatusAfter: 'removed' as const,
        blockerCode: 'member_revoked' as const,
        activeMembershipRequired: true,
        inviteRecoveryRequired: true,
        ownerlessRecoveryMutationAllowed: false,
        readiness: {
            sharedWatchlistExportReady: false,
            alertGenerationReady: false,
            caseVisibilityReady: false,
            webhookDeliveryReady: false,
            dashboardReadinessReady: false,
        },
        requiredDownstreamFields: [
            'organizationId',
            'tenantId',
            'watchlistId',
            'watchlistItemId',
            'watchedEntity',
            'matchReason',
            'actorRef',
            'sourceRefs',
            'provenanceHash',
            'workflowStatus',
            'destinationReadiness',
            'blockerReason',
        ],
        blockedConsumerContracts: [
            'organization.watchlist_alert_generation_consumer.v1',
            'organization.case_visibility_consumer.v1',
            'organization.alert_case_bridge_persistence_receipt.v1',
            'organization.webhook_destination_access_decision.v1',
            'organization.webhook_alert_delivery_readiness.v1',
            'organization.shared_watchlist_readiness_export.v1',
        ],
        downstreamRoutes: { ...organizationAccessDownstreamRoutes },
        destinationReadiness: {
            destinationOwnerField: 'destination.org_id' as const,
            selectedDestinationIdField: 'webhookDestinationIds[]' as const,
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: false,
            deliveryBlockedByLifecycle: true,
            blockerReason: 'member_revoked' as const,
        },
        lifecycleCleanup: {
            revokedInviteIds: revokedInviteIds,
            revokedInviteCount: revokedInviteCount,
            cleanupIdempotent: true,
            staleInviteAcceptanceBlocker: 'member_revoked' as const,
            noOrphanedAlertCaseLinks: true,
            noCrossOrgLeakage: true,
        },
        noLeakFields: [
            'activeTerms[]',
            'watchlistScope.alertGeneratorKeys',
            'destination.secret',
            'destination.endpoint',
            'case.evidence.rawContent',
            'otherOrg.watchlistItemIds',
            'otherOrg.destinationIds',
        ],
    }
}
