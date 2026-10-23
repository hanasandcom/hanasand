import {
    buildOrganizationBridgeContext,
    organizationWatchlistLifecycleProjection,
    organizationWatchlistAlertGenerationContractFromProjection,
    roleCanManageOrganization,
    roleCanWriteWatchlist,
    type OrganizationRow,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'

export function organizationTeamOnboardingReadiness(organization: ReturnType<typeof buildOrganizationBridgeContext>) {
    const targetMemberCount = 10
    const acceptedOrInvitedCount = organization.activeMemberCount + organization.pendingInviteCount
    const blockedReasons: string[] = []
    if (acceptedOrInvitedCount < targetMemberCount) {
        blockedReasons.push('needs_10_active_members_or_pending_invites')
    }

    if (organization.sharedWatchlistCount < 1) {
        blockedReasons.push('needs_shared_watchlist_item')
    }

    return {
        schemaVersion: 'organization.team_onboarding_readiness.v1',
        targetMemberCount,
        activeMemberCount: organization.activeMemberCount,
        pendingInviteCount: organization.pendingInviteCount,
        acceptedOrInvitedCount,
        sharedWatchlistCount: organization.sharedWatchlistCount,
        alertVisibilityPolicy: organization.alertVisibilityPolicy,
        canSupportTenMemberSharedWatchlistRollout: blockedReasons.length === 0,
        blockedReasons,
    }
}

export function organizationSharedWatchlistContract(organization: OrganizationRow, items: OrganizationWatchlistRow[]) {
    const bridgeContext = buildOrganizationBridgeContext({
        ...organization,
        shared_watchlist_count: items.length,
    })
    const watchlistProjection = organizationWatchlistLifecycleProjection(items)
    const alertGeneration = organizationWatchlistAlertGenerationContractFromProjection(organization, watchlistProjection)
    const { active: activeItems, paused: pausedItems, archived: archivedItems } = watchlistProjection.itemsByStatus
    return {
        schemaVersion: 'organization.shared_watchlist_contract.v1',
        capabilities: {
            authoritativeProjectionSync: true,
            projectionReceiptSchemaVersion: 'organization.watchlist_projection_receipt.v1',
        },
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        visibilityPolicy: bridgeContext.alertVisibilityPolicy,
        allowedViewerRoles: bridgeContext.allowedViewerRoles,
        activeWatchlistTerms: alertGeneration.activeWatchlistTerms,
        termFamilies: alertGeneration.termFamilies,
        blockedReasons: alertGeneration.blockedReasons,
        canGenerateAlerts: alertGeneration.canGenerateAlerts,
        ownership: {
            organizationId: organization.id,
            ownerOrganizationId: organization.id,
            itemIds: items.map(item => item.id),
            activeItemIds: activeItems.map(item => item.id),
            pausedItemIds: pausedItems.map(item => item.id),
            archivedItemIds: archivedItems.map(item => item.id),
            creatorUserIds: [...new Set(items.map(item => item.created_by))].sort(),
            updaterUserIds: [...new Set(items.map(item => item.updated_by).filter(Boolean))].sort(),
            duplicateTermScope: 'organization',
            crossOrgEnumerationAllowed: false,
        },
        lifecycle: {
            activeCount: activeItems.length,
            pausedCount: pausedItems.length,
            archivedCount: archivedItems.length,
            cleanupRequired: pausedItems.length + archivedItems.length > 0,
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            archiveRoute: 'DELETE /api/organizations/:organizationId/watchlists/:itemId',
            actionRoute: 'POST /api/organizations/:organizationId/watchlists/:itemId/actions',
            cleanupIdempotent: true,
        },
        alertExportBridge: {
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            organizationId: organization.id,
            tenantId: organization.id,
            watchlistItemIds: alertGeneration.activeWatchlistTerms.map(term => term.watchlistItemId),
            termFamilies: alertGeneration.termFamilies,
            requiredFields: [
                'organizationId',
                'tenantId',
                'ownerOrganizationId',
                'sourceFamily',
                'activeTerms[].watchlistItemId',
                'activeTerms[].ownerOrganizationId',
                'activeTerms[].matchedTerm.termFamily',
                'activeTerms[].alertGenerationRef',
                'activeTerms[].alertGeneratorKey',
            ],
            ownerContextFields: [
                'ownerOrganizationId',
                'activeTerms[].ownerOrganizationId',
                'activeTerms[].createdBy',
                'activeTerms[].updatedBy',
                'activeTerms[].lifecycleRequestId',
            ],
            webhookOwnership: {
                schemaVersion: 'organization.shared_watchlist_webhook_ownership_hint.v1',
                requiredDestinationOrgId: organization.id,
                selectedDestinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                requiredAlertFields: ['alert.organizationId', 'alert.ownerOrganizationId', 'alert.watchlistItemIds'],
                redactedFields: ['destination.secret'],
                nonmemberDestinationEnumeration: false,
            },
            blockedReasons: alertGeneration.blockedReasons,
        },
        permissions: {
            actorRole: organization.role ?? 'viewer',
            canRead: true,
            canWrite: roleCanWriteWatchlist(organization.role),
            canArchive: roleCanWriteWatchlist(organization.role),
            canCleanup: roleCanManageOrganization(organization.role),
            writeRoles: ['owner', 'admin'],
            readRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
            nonmemberEnumeration: false,
        },
    }
}
