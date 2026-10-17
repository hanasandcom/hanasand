import { roleCanManageOrganization } from '../../organizationRoles.ts'
import type { OrganizationMemberRow, OrganizationRow } from '../rowTypes.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import { organizationVisibilityDecision } from '../../organizationVisibility.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationAlertCaseRoleActions, organizationAlertCaseRoleActionContract, roleCanWriteWatchlist, organizationRolesFor } from './roleActions.ts'
import { memberRoleTargetRoles } from '../organizationInputs.ts'

export function organizationMemberAccessContract(
    organization: Pick<OrganizationRow, 'id' | 'role' | 'status' | 'alert_visibility_policy'>,
    members: Array<Pick<OrganizationMemberRow, 'user_id' | 'role' | 'status'>>
) {
    const activeMembers = members.filter(member => member.status === 'active')
    const roleCounts = activeMembers.reduce((counts, member) => {
        counts[member.role] += 1
        return counts
    }, {
        owner: 0,
        admin: 0,
        editor: 0,
        reader: 0,
        member: 0,
        viewer: 0,
    } satisfies Record<OrganizationRole, number>)
    const actorRole = organization.role ?? 'viewer'
    const roleActionContract = organizationAlertCaseRoleActionContract({
        userId: 'organization_member_read',
        role: actorRole,
    })
    const visibility = organizationVisibilityDecision({
        role: actorRole,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })

    return {
        schemaVersion: 'organization.member_access_contract.v1' as const,
        ...organizationTenantIdentity(organization.id, organization.id),
        actor: {
            role: actorRole,
            status: organization.status ?? 'active',
            canManageInvites: roleCanManageOrganization(actorRole),
            canManageMembers: roleCanManageOrganization(actorRole),
            canManageWatchlists: roleCanWriteWatchlist(actorRole),
            canReadSharedWatchlists: true,
            canExportAlertTerms: visibility.allowed,
            allowedAlertCaseActions: organizationAlertCaseRoleActions(actorRole),
        },
        counts: {
            activeMemberCount: activeMembers.length,
            ownerCount: roleCounts.owner,
            adminCount: roleCounts.admin,
            editorCount: roleCounts.editor,
            readerCount: roleCounts.reader + roleCounts.member + roleCounts.viewer,
            memberCount: roleCounts.member,
            viewerCount: roleCounts.viewer,
            activeAdminCount: roleCounts.owner + roleCounts.admin,
        },
        roleGates: {
            createWatchlist: organizationRolesFor('watchlistEditors'),
            updateWatchlist: organizationRolesFor('watchlistEditors'),
            pauseWatchlist: organizationRolesFor('watchlistEditors'),
            archiveWatchlist: organizationRolesFor('watchlistEditors'),
            manageInvites: organizationRolesFor('managers'),
            manageMembers: organizationRolesFor('managers'),
            readSharedWatchlists: organizationRolesFor('sharedWatchlistReaders'),
            exportAlertTerms: visibility.allowedRoles,
            acknowledgeAlert: roleActionContract.roleGates.acknowledge_alert,
            assignCase: roleActionContract.roleGates.assign_case,
            linkCase: roleActionContract.roleGates.link_case,
        },
        memberLifecycle: {
            schemaVersion: 'organization.member_lifecycle_contract.v1' as const,
            routes: {
                listMembers: 'GET /api/organizations/:id/members',
                updateRole: 'PATCH /api/organizations/:id/members/:userId/role',
                removeMember: 'DELETE /api/organizations/:id/members/:userId',
                transferOwnership: 'POST /api/organizations/:id/ownership-transfer',
            },
            actorRole,
            allowedMutators: organizationRolesFor('managers'),
            roleTargets: [...memberRoleTargetRoles],
            roleChange: {
                ownerCanAssign: [...memberRoleTargetRoles],
                adminCanAssign: organizationRolesFor('adminAssignableRoles'),
                memberCanAssign: [],
                viewerCanAssign: [],
                requestMetadataFields: ['requestId', 'reason', 'previousRole', 'newRole'],
                serviceLogAction: 'organization_member_role_updated',
            },
            removal: {
                ownerCanRemove: ['admin', 'editor', 'reader'],
                adminCanRemove: ['editor', 'reader'],
                lastOwnerBlocked: true,
                ownerRemovalRequiresTransfer: true,
                removedMemberStatus: 'removed',
                removedMemberDeniedFromWatchlists: true,
                removedMemberDeniedFromAlertTerms: true,
                serviceLogAction: 'organization_member_removed',
            },
            ownership: {
                transferRoute: 'POST /api/organizations/:id/ownership-transfer',
                reasonRequired: true,
                lastOwnerGuard: true,
                serviceLogAction: 'organization_ownership_transferred',
            },
            audit: {
                source: 'events',
                requiredMetadataFields: ['requestId', 'reason', 'actorId', 'targetUserId', 'organizationId'],
            },
            noLeakFields: [
                'otherOrg.members',
                'watchlistScope.alertGeneratorKeys',
                'activeTerms[]',
                'destination.secret',
            ],
        },
        lifecycleDenials: {
            inactiveOrganization: organization.status === 'archived' ? 'org_archived' : organization.status === 'deleted' ? 'org_deleted' : null,
            revokedMember: 'member_revoked',
            expiredInvite: 'invite_expired',
            nonmember: 'nonmember_denied',
            pausedWatchlist: 'watchlist_paused',
            archivedWatchlist: 'watchlist_archived',
        },
        downstreamConsumers: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
            sharedWatchlists: 'GET /api/organizations/:id/watchlists',
        },
    }
}
