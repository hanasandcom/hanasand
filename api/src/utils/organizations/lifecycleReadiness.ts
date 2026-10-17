import type { OrganizationLifecycleReadiness, OrganizationLifecycleReadinessBlockerCode } from './contracts/lifecycleReadiness.ts'
import type { OrganizationRow } from './rowTypes.ts'
import { roleCanManageOrganization } from '../organizationRoles.ts'
import { allowedOrganizationVisibilityRoles } from '../organizationVisibility.ts'
import { normalizeOrganizationStatus } from './normalization/organizationValues.ts'
import { organizationTenantIdentity } from './identity.ts'
import { buildWorkspaceBoundaryProof } from './workspaceBoundaryProof.ts'

export function organizationLifecycleReadiness(row: OrganizationRow): OrganizationLifecycleReadiness {
    const memberCount = Number(row.member_count ?? 0)
    const ownerCount = Number(row.owner_count ?? 0)
    const activeAdminCount = Number(row.admin_count ?? row.owner_count ?? 0)
    const pendingInviteCount = Number(row.pending_invite_count ?? 0)
    const sharedWatchlistCount = Number(row.shared_watchlist_count ?? 0)
    const actorRole = row.role ?? 'viewer'
    const lifecycleStatus = normalizeOrganizationStatus(row.status)
    const typedBlockers: OrganizationLifecycleReadinessBlockerCode[] = []
    if (lifecycleStatus === 'archived') {
        typedBlockers.push('org_archived')
    }

    if (lifecycleStatus === 'deleted') {
        typedBlockers.push('org_deleted')
    }

    if (activeAdminCount < 1) {
        typedBlockers.push('no_active_admin')
    }

    if (sharedWatchlistCount < 1) {
        typedBlockers.push('watchlist_setup_required', 'alert_export_unavailable')
    }

    const lifecycleBlockerCode = lifecycleStatus === 'archived'
        ? 'org_archived'
        : lifecycleStatus === 'deleted'
            ? 'org_deleted'
            : null
    const lifecycleAllowsDownstream = lifecycleBlockerCode === null
    const actorCanManageOrganization = roleCanManageOrganization(actorRole)

    return {
        schemaVersion: 'organization.lifecycle_readiness.v1',
        ...organizationTenantIdentity(row.id, row.id),
        lifecycleStatus,
        actorRole,
        counts: {
            memberCount,
            activeMemberCount: memberCount,
            ownerCount,
            activeAdminCount,
            pendingInviteCount,
            sharedWatchlistCount,
        },
        memberRoleReadiness: {
            ownerCanMutate: actorRole === 'owner',
            adminCanMutate: actorRole === 'owner' || actorRole === 'admin',
            memberCanReadAndExport: allowedOrganizationVisibilityRoles('members').includes(actorRole),
            supportReadMode: 'redacted_support_contract_only',
            nonmemberEnumeration: false,
            revokedMemberDenial: 'member_revoked',
            expiredInviteDenial: 'invite_expired',
            noActiveAdminBlocker: 'no_active_admin',
        },
        organizationLifecycle: {
            missingBlocker: 'org_missing',
            archivedBlocker: 'org_archived',
            deletedBlocker: 'org_deleted',
        },
        watchlistReadiness: {
            ready: sharedWatchlistCount > 0,
            activeSharedWatchlistCount: sharedWatchlistCount,
            setupBlocker: 'watchlist_setup_required',
        },
        alertExportReadiness: {
            ready: lifecycleStatus === 'active' && sharedWatchlistCount > 0 && activeAdminCount > 0,
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            unavailableBlocker: 'alert_export_unavailable',
        },
        cleanupReadiness: {
            cleanupRequired: false,
            cleanupIdempotent: true,
            route: 'POST /api/organizations/:id/watchlists/cleanup',
            cleanupRequiredBlocker: 'cleanup_required',
        },
        supportVisibility: {
            mode: 'redacted_summary_only',
            contract: 'admin_support',
            redactionBlocker: 'support_redaction_required',
        },
        downstreamLifecycleReceipt: {
            schemaVersion: 'organization.lifecycle_downstream_receipt.v1',
            ...organizationTenantIdentity(row.id, row.id),
            lifecycleStatus,
            blockerCode: lifecycleBlockerCode,
            activeMembershipRequired: true,
            inviteMutationAllowed: lifecycleAllowsDownstream,
            watchlistMutationAllowed: lifecycleAllowsDownstream,
            alertExportAllowed: lifecycleAllowsDownstream && sharedWatchlistCount > 0 && activeAdminCount > 0,
            caseVisibilityAllowed: lifecycleAllowsDownstream,
            webhookDeliveryAllowed: lifecycleAllowsDownstream,
            supportRedactedReadAllowed: true,
            blockedRoutes: lifecycleAllowsDownstream ? [] : [
                'POST /api/organizations/:id/invites',
                'POST /api/organizations/:id/watchlists',
                'GET /api/organizations/:id/watchlists/alert-terms',
                'GET /api/organizations/:id/alert-readiness',
                'GET /api/organizations/:id/alert-case-visibility',
                'POST /v1/dwm/webhooks/deliver',
            ],
            downstreamRefs: {
                alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1',
                caseVisibilityConsumer: 'organization.case_visibility_consumer.v1',
                webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1',
            },
            noLeakFields: [
                'activeTerms[]',
                'watchlistScope.alertGeneratorKeys',
                'destination.secret',
                'case.evidence.rawContent',
            ],
        },
        workspaceBoundaryProof: buildWorkspaceBoundaryProof({
            organizationId: row.id,
            lifecycleStatus,
            actorRole,
            actorCanManageOrganization,
            lifecycleAllowsDownstream,
            lifecycleBlockerCode,
        }),
        dashboardFields: [
            'organizationId',
            'tenantId',
            'lifecycleStatus',
            'counts.memberCount',
            'counts.activeAdminCount',
            'counts.pendingInviteCount',
            'counts.sharedWatchlistCount',
            'memberRoleReadiness',
            'watchlistReadiness',
            'alertExportReadiness',
            'cleanupReadiness',
            'supportVisibility',
            'downstreamLifecycleReceipt',
            'workspaceBoundaryProof',
            'typedBlockers',
        ],
        typedBlockers,
        blockerCatalog: [
            'org_missing',
            'org_archived',
            'org_deleted',
            'no_active_admin',
            'member_revoked',
            'invite_expired',
            'watchlist_setup_required',
            'alert_export_unavailable',
            'support_redaction_required',
            'cleanup_required',
        ],
        readyForOnboarding: typedBlockers.length === 0,
    }
}

