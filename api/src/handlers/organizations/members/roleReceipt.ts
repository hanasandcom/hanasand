import { organizationAccessDownstreamRoutes } from '../downstreamRoutes.ts'
import { roleCanManageOrganization, roleCanWriteWatchlist, type OrganizationRole } from '#utils/organizations.ts'

type MemberRoleReceiptInput = {
    organizationId: string
    actorId: string
    actorRole: OrganizationRole | undefined
    targetUserId: string
    previousRole: OrganizationRole
    newRole: OrganizationRole
    reason: string
    requestId?: string
    serviceLogAction: string
}

function memberConsumerAccess(role: OrganizationRole) {
    const canManage = roleCanManageOrganization(role)
    return {
        role,
        canReadSharedWatchlists: true,
        canExportAlertTerms: canManage,
        canMutateSharedWatchlists: roleCanWriteWatchlist(role),
        canAssignCases: canManage,
        canDryRunWebhookDelivery: canManage,
        canReadWebhookDeliverySummary: true,
    }
}

function memberDownstreamReadiness(access: ReturnType<typeof memberConsumerAccess>) {
    return {
        sharedWatchlistReadReady: access.canReadSharedWatchlists,
        alertGenerationExportReady: access.canExportAlertTerms,
        watchlistMutationReady: access.canMutateSharedWatchlists,
        caseAssignmentReady: access.canAssignCases,
        webhookDeliveryReady: access.canDryRunWebhookDelivery,
        deliverySummaryReady: access.canReadWebhookDeliverySummary,
    }
}

export function buildOrganizationMemberRoleChangeReceipt({
    organizationId,
    actorId,
    actorRole,
    targetUserId,
    previousRole,
    newRole,
    reason,
    requestId,
    serviceLogAction,
}: MemberRoleReceiptInput) {
    const before = memberConsumerAccess(previousRole)
    const after = memberConsumerAccess(newRole)
    const watchlistWriteRoles = (['owner', 'admin', 'editor', 'reader', 'member', 'viewer'] satisfies OrganizationRole[])
        .filter(roleCanWriteWatchlist)

    return {
        schemaVersion: 'organization.member_role_change.v1',
        organizationId,
        tenantId: organizationId,
        actorId,
        targetUserId,
        previousRole,
        newRole,
        reason,
        requestId: requestId ?? null,
        serviceLogAction,
        consumerVisibilityReceipt: {
            schemaVersion: 'organization.member_role_consumer_visibility_receipt.v1',
            organizationId,
            tenantId: organizationId,
            actorId,
            actorRole,
            targetUserId,
            previousRole,
            newRole,
            membershipStatus: 'active' as const,
            routes: {
                sharedWatchlists: 'GET /api/organizations/:id/watchlists',
                alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
                alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
                webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
            },
            consumerContracts: [
                'organization.watchlist_alert_generation_consumer.v1',
                'organization.watchlist_alert_generation_consumer_denial.v1',
                'organization.case_visibility_consumer.v1',
                'organization.webhook_destination_access_decision.v1',
                'organization.webhook_alert_delivery_readiness.v1',
            ],
            before,
            after,
            deliveryReadiness: {
                schemaVersion: 'organization.member_role_delivery_readiness.v1',
                contract: 'organization.webhook_alert_delivery_readiness.v1',
                allowedRoles: ['owner', 'admin'],
                summaryVisibleRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
                deniedRoles: ['member', 'viewer'],
                destinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                nonmemberDestinationEnumeration: false,
            },
            blockerCodes: {
                nonmember: 'nonmember_denied' as const,
                removedMember: 'member_revoked' as const,
                alertVisibility: 'role_not_allowed' as const,
                webhookDelivery: 'role_not_allowed' as const,
            },
            noEnumeration: true,
            downstreamReadinessReceipt: {
                schemaVersion: 'organization.member_role_downstream_readiness_receipt.v1',
                organizationId,
                tenantId: organizationId,
                actorId,
                actorRole,
                targetUserId,
                previousRole,
                newRole,
                membershipStatus: 'active' as const,
                roleChanged: previousRole !== newRole,
                blockerReason: null,
                before: memberDownstreamReadiness(before),
                after: memberDownstreamReadiness(after),
                downstreamRoutes: { ...organizationAccessDownstreamRoutes },
                downstreamContracts: [
                    'organization.watchlist_alert_generation_consumer.v1',
                    'organization.case_visibility_consumer.v1',
                    'organization.alert_case_bridge_persistence_receipt.v1',
                    'organization.webhook_destination_delivery_consumer.v1',
                    'organization.shared_watchlist_readiness_export.v1',
                ],
                destinationReadiness: {
                    destinationOwnerField: 'destination.org_id' as const,
                    selectedDestinationIdField: 'webhookDestinationIds[]' as const,
                    crossOrgDestinationAllowed: false,
                    nonmemberDestinationEnumeration: false,
                },
                roleGates: {
                    mutateWatchlists: watchlistWriteRoles,
                    exportAlertTerms: ['owner', 'admin'] as const,
                    assignCases: ['owner', 'admin', 'editor'] as const,
                    webhookDelivery: ['owner', 'admin'] as const,
                    readSharedWatchlists: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'] as const,
                },
                lifecycleBlockers: {
                    removedMember: 'member_revoked' as const,
                    expiredInvite: 'invite_expired' as const,
                    roleNotAllowed: 'role_not_allowed' as const,
                },
                noLeakFields: [
                    'otherOrg.watchlistItemIds',
                    'otherOrg.alertGeneratorKeys',
                    'destination.secret',
                    'case.evidence.rawContent',
                ],
            },
        },
    }
}
