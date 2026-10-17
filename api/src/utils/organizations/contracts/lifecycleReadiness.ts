import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationLifecycleStatus } from '../inputTypes.ts'

export type OrganizationLifecycleReadinessBlockerCode =
    | 'org_missing'
    | 'org_archived'
    | 'org_deleted'
    | 'no_active_admin'
    | 'member_revoked'
    | 'invite_expired'
    | 'watchlist_setup_required'
    | 'alert_export_unavailable'
    | 'support_redaction_required'
    | 'cleanup_required'

export type OrganizationLifecycleReadiness = {
    schemaVersion: 'organization.lifecycle_readiness.v1'
    organizationId: string
    tenantId: string
    lifecycleStatus: OrganizationLifecycleStatus
    actorRole: OrganizationRole
    counts: {
        memberCount: number
        activeMemberCount: number
        ownerCount: number
        activeAdminCount: number
        pendingInviteCount: number
        sharedWatchlistCount: number
    }
    memberRoleReadiness: {
        ownerCanMutate: boolean
        adminCanMutate: boolean
        memberCanReadAndExport: boolean
        supportReadMode: 'redacted_support_contract_only'
        nonmemberEnumeration: false
        revokedMemberDenial: 'member_revoked'
        expiredInviteDenial: 'invite_expired'
        noActiveAdminBlocker: 'no_active_admin'
    }
    organizationLifecycle: {
        missingBlocker: 'org_missing'
        archivedBlocker: 'org_archived'
        deletedBlocker: 'org_deleted'
    }
    watchlistReadiness: {
        ready: boolean
        activeSharedWatchlistCount: number
        setupBlocker: 'watchlist_setup_required'
    }
    alertExportReadiness: {
        ready: boolean
        route: 'GET /api/organizations/:id/watchlists/alert-terms'
        unavailableBlocker: 'alert_export_unavailable'
    }
    cleanupReadiness: {
        cleanupRequired: boolean
        cleanupIdempotent: true
        route: 'POST /api/organizations/:id/watchlists/cleanup'
        cleanupRequiredBlocker: 'cleanup_required'
    }
    supportVisibility: {
        mode: 'redacted_summary_only'
        contract: 'admin_support'
        redactionBlocker: 'support_redaction_required'
    }
    downstreamLifecycleReceipt: {
        schemaVersion: 'organization.lifecycle_downstream_receipt.v1'
        organizationId: string
        tenantId: string
        lifecycleStatus: OrganizationLifecycleStatus
        blockerCode: Extract<OrganizationLifecycleReadinessBlockerCode, 'org_archived' | 'org_deleted'> | null
        activeMembershipRequired: true
        inviteMutationAllowed: boolean
        watchlistMutationAllowed: boolean
        alertExportAllowed: boolean
        caseVisibilityAllowed: boolean
        webhookDeliveryAllowed: boolean
        supportRedactedReadAllowed: true
        blockedRoutes: string[]
        downstreamRefs: {
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1'
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1'
            webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1'
        }
        noLeakFields: Array<'activeTerms[]' | 'watchlistScope.alertGeneratorKeys' | 'destination.secret' | 'case.evidence.rawContent'>
    }
    workspaceBoundaryProof: {
        schemaVersion: 'organization.workspace_boundary_readiness.v1'
        organizationId: string
        tenantId: string
        lifecycleStatus: OrganizationLifecycleStatus
        actorRole: OrganizationRole
        routes: {
            createOrganization: 'POST /api/organizations'
            readOrganization: 'GET /api/organizations/:id'
            readSettings: 'GET /api/organizations/:id/settings'
            updateSettings: 'PUT /api/organizations/:id/settings'
            listMembers: 'GET /api/organizations/:id/members'
            listInvites: 'GET /api/organizations/:id/invites'
            listWatchlists: 'GET /api/organizations/:id/watchlists'
            alertReadiness: 'GET /api/organizations/:id/alert-readiness'
        }
        roleGates: {
            readOrganization: OrganizationRole[]
            updateSettings: Array<'owner' | 'admin'>
            archiveOrganization: Array<'owner' | 'admin'>
            deleteOrganization: Array<'owner' | 'admin'>
            manageInvites: Array<'owner' | 'admin'>
            mutateWatchlists: Array<'owner' | 'admin' | 'editor'>
            readSharedWatchlists: OrganizationRole[]
        }
        actorPermissions: {
            canReadOrganization: true
            canUpdateSettings: boolean
            canArchiveOrganization: boolean
            canDeleteOrganization: boolean
            canManageInvites: boolean
            canMutateWatchlists: boolean
            canReadSharedWatchlists: true
            canReadAlertReadiness: true
        }
        supportInspection: {
            mode: 'redacted_summary_only'
            contract: 'admin_support'
            route: '/api/admin/support/organizations/:id'
        }
        lifecycleMutationAllowed: boolean
        blockedWhenInactive: Array<
            | 'PUT /api/organizations/:id/settings'
            | 'POST /api/organizations/:id/invites'
            | 'POST /api/organizations/:id/watchlists'
            | 'POST /api/organizations/:id/watchlists/:itemId/actions'
            | 'POST /api/organizations/:id/ownership-transfer'
        >
        blockerCode: Extract<OrganizationLifecycleReadinessBlockerCode, 'org_archived' | 'org_deleted'> | null
        nonmemberEnumeration: false
        noLeakFields: Array<'otherOrg.members' | 'otherOrg.invites' | 'otherOrg.watchlistItemIds' | 'destination.secret'>
    }
    dashboardFields: string[]
    typedBlockers: OrganizationLifecycleReadinessBlockerCode[]
    blockerCatalog: OrganizationLifecycleReadinessBlockerCode[]
    readyForOnboarding: boolean
}

