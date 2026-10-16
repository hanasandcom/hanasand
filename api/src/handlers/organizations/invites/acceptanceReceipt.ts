import { organizationInviteAcceptanceReference, toInvite, toOrganization } from '#utils/organizations.ts'
import type { OrganizationRole, OrganizationRow } from '#utils/organizations.ts'
import { organizationAccessDownstreamRoutes } from '../downstreamRoutes.ts'

export type AcceptedInviteRow = {
    invite_id: string
    organization_id: string
    email: string
    invite_role: OrganizationRole
    invited_by: string
    accepted_by: string
    invite_status: 'accepted'
    invite_created_at: string
    accepted_at: string
    expires_at: string
    user_id: string
    member_role: OrganizationRole
    member_status: 'active'
    joined_at: string
    member_created_at: string
}

export function buildOrganizationInviteAcceptanceResponse({
    row,
    userId,
    serviceLogAction,
    organization,
}: {
    row: AcceptedInviteRow
    userId: string
    serviceLogAction: string
    organization: OrganizationRow | undefined
}) {
    return {
        invite: toInvite({
            id: row.invite_id,
            organization_id: row.organization_id,
            email: row.email,
            role: row.invite_role,
            invited_by: row.invited_by,
            accepted_by: row.accepted_by,
            status: row.invite_status,
            created_at: row.invite_created_at,
            expires_at: row.expires_at,
            accepted_at: row.accepted_at,
        }),
        membership: {
            organizationId: row.organization_id,
            userId: row.user_id,
            role: row.member_role,
            status: row.member_status,
            joinedAt: row.joined_at,
            createdAt: row.member_created_at,
        },
        inviteAcceptance: {
            schemaVersion: 'organization.invite_acceptance.v1',
            organizationId: row.organization_id,
            tenantId: row.organization_id,
            inviteId: row.invite_id,
            ...organizationInviteAcceptanceReference(row.invite_id),
            acceptedBy: userId,
            invitedBy: row.invited_by,
            inviteRole: row.invite_role,
            appliedRole: row.member_role,
            membershipStatus: row.member_status,
            acceptedAt: row.accepted_at,
            expiresAt: row.expires_at,
            serviceLogAction,
            auditMetadataFields: ['inviteId', 'role', 'acceptedBy', 'organizationId'],
            reusedInviteBlocked: true,
            expiredInviteDenied: 'invite_expired',
            revokedInviteDenied: 'member_revoked',
            consumerVisibilityReceipt: {
                schemaVersion: 'organization.invite_consumer_visibility_receipt.v1',
                organizationId: row.organization_id,
                tenantId: row.organization_id,
                inviteId: row.invite_id,
                inviteStatus: row.invite_status,
                role: row.member_role,
                action: 'accept' as const,
                actorId: userId,
                actorRole: row.member_role,
                grantsConsumerAccess: true,
                membershipStatus: row.member_status,
                routes: {
                    sharedWatchlists: 'GET /api/organizations/:id/watchlists',
                    alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
                    alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
                },
                availableConsumerContracts: [
                    'organization.watchlist_alert_generation_consumer.v1',
                    'organization.case_visibility_consumer.v1',
                ],
                roleGates: {
                    canReadSharedWatchlists: true,
                    canExportAlertTerms: ['owner', 'admin'].includes(row.member_role),
                    canMutateSharedWatchlists: ['owner', 'admin'].includes(row.member_role),
                    canAssignCases: ['owner', 'admin'].includes(row.member_role),
                },
                downstreamReadinessGrant: {
                    schemaVersion: 'organization.invite_acceptance_downstream_grant.v1',
                    organizationId: row.organization_id,
                    tenantId: row.organization_id,
                    inviteId: row.invite_id,
                    acceptedBy: userId,
                    membershipStatus: row.member_status,
                    appliedRole: row.member_role,
                    grantsConsumerAccess: true,
                    sharedWatchlistReadReady: true,
                    alertGenerationExportReady: ['owner', 'admin'].includes(row.member_role),
                    caseVisibilityReady: true,
                    webhookDeliveryReady: ['owner', 'admin'].includes(row.member_role),
                    dashboardReadinessReady: true,
                    blockerReason: null,
                    downstreamContracts: [
                        'organization.watchlist_alert_generation_consumer.v1',
                        'organization.case_visibility_consumer.v1',
                        'organization.webhook_destination_delivery_consumer.v1',
                        'organization.shared_watchlist_readiness_export.v1',
                    ],
                    downstreamRoutes: { ...organizationAccessDownstreamRoutes },
                    destinationReadiness: {
                        destinationOwnerField: 'destination.org_id' as const,
                        selectedDestinationIdField: 'webhookDestinationIds[]' as const,
                        crossOrgDestinationAllowed: false,
                        nonmemberDestinationEnumeration: false,
                    },
                    noLeakFields: [
                        'otherOrg.watchlistItemIds',
                        'otherOrg.alertGeneratorKeys',
                        'destination.secret',
                        'case.evidence.rawContent',
                    ],
                },
                noEnumeration: true,
            },
        },
        organization: organization ? toOrganization(organization) : null,
    }
}
