import type { OrganizationInviteRow, OrganizationRow, OrganizationInviteAction } from '#utils/organizations.ts'
import { organizationInviteAcceptanceReference } from '#utils/organizations.ts'
import { organizationAccessDownstreamRoutes } from '../downstreamRoutes.ts'

type InviteActionReceiptInput = {
    organizationId: string
    actorId: string
    actorRole: OrganizationRow['role']
    invite: OrganizationInviteRow
    action: OrganizationInviteAction
    previousStatus: OrganizationInviteRow['status']
    reason?: string | null
    requestId?: string | null
    serviceLogAction: string
}

export function buildOrganizationInviteActionReceipt({
    organizationId,
    actorId,
    actorRole,
    invite,
    action,
    previousStatus,
    reason,
    requestId,
    serviceLogAction,
}: InviteActionReceiptInput) {
    return {
        schemaVersion: 'organization.invite_action.v1',
        organizationId: organizationId,
        tenantId: organizationId,
        inviteId: invite.id,
        email: invite.email,
        role: invite.role,
        action: action,
        actorId: actorId,
        actorRole: actorRole,
        previousStatus: previousStatus,
        status: invite.status,
        reason: reason,
        requestId: requestId ?? null,
        serviceLogAction,
        ...organizationInviteAcceptanceReference(invite.id),
        consumerVisibilityReceipt: {
            schemaVersion: 'organization.invite_consumer_visibility_receipt.v1',
            organizationId: organizationId,
            tenantId: organizationId,
            inviteId: invite.id,
            inviteStatus: invite.status,
            role: invite.role,
            action: action,
            actorId: actorId,
            actorRole: actorRole,
            grantsConsumerAccess: false,
            acceptanceRequired: true,
            blockerCode: action === 'resend' ? 'invite_pending' as const : 'member_revoked' as const,
            blockedRoutes: [
                'GET /api/organizations/:id/watchlists',
                'GET /api/organizations/:id/watchlists/alert-terms',
                'GET /api/organizations/:id/alert-case-visibility',
            ],
            blockedConsumerContracts: [
                'organization.watchlist_alert_generation_consumer.v1',
                'organization.case_visibility_consumer.v1',
                'organization.webhook_alert_delivery_readiness.v1',
            ],
            noEnumeration: true,
        },
        downstreamReadinessReceipt: {
            schemaVersion: 'organization.invite_downstream_readiness_receipt.v1',
            organizationId: organizationId,
            tenantId: organizationId,
            inviteId: invite.id,
            inviteStatus: invite.status,
            role: invite.role,
            action: action,
            previousStatus: previousStatus,
            actorId: actorId,
            actorRole: actorRole,
            requestId: requestId ?? null,
            reason: reason ?? null,
            grantsConsumerAccess: false,
            acceptanceRequired: true,
            blockerReason: action === 'resend' ? 'invite_pending' as const : 'member_revoked' as const,
            readiness: {
                sharedWatchlistReadReady: false,
                alertGenerationReady: false,
                caseVisibilityReady: false,
                webhookDeliveryReady: false,
                dashboardReadinessReady: false,
                supportRedactedReadReady: true,
            },
            downstreamRoutes: { ...organizationAccessDownstreamRoutes },
            downstreamContracts: [
                'organization.watchlist_alert_generation_consumer.v1',
                'organization.case_visibility_consumer.v1',
                'organization.alert_case_bridge_persistence_receipt.v1',
                'organization.webhook_destination_delivery_consumer.v1',
                'organization.shared_watchlist_readiness_export.v1',
            ],
            requiredAcceptedMembershipFields: [
                'organizationId',
                'tenantId',
                'member.userId',
                'member.role',
                'member.status',
                'watchlistId',
                'watchlistItemId',
                'provenanceHash',
                'destinationReadiness',
                'blockerReason',
            ],
            destinationReadiness: {
                destinationOwnerField: 'destination.org_id' as const,
                selectedDestinationIdField: 'webhookDestinationIds[]' as const,
                deliveryBlockedUntilAccepted: true,
                crossOrgDestinationAllowed: false,
                nonmemberDestinationEnumeration: false,
            },
            lifecycleCleanup: {
                revokeIdempotent: true,
                resendIdempotent: true,
                expiredInviteBlocker: 'invite_expired' as const,
                revokedInviteBlocker: 'member_revoked' as const,
                noOrphanedInviteTokens: true,
                noCrossOrgLeakage: true,
            },
            noLeakFields: [
                'activeTerms[]',
                'watchlistScope.alertGeneratorKeys',
                'destination.secret',
                'case.evidence.rawContent',
                'otherOrg.watchlistItemIds',
            ],
        },
    }
}
