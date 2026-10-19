import type { OrganizationLifecycleReadiness, OrganizationLifecycleReadinessBlockerCode } from './contracts/lifecycleReadiness.ts'
import type { OrganizationRole } from '../organizationRoles.ts'
import type { OrganizationLifecycleStatus } from './inputTypes.ts'
import { organizationTenantIdentity } from './identity.ts'
import { organizationRolesFor } from './authorization/roleActions.ts'

export function buildWorkspaceBoundaryProof(input: {
    organizationId: string
    lifecycleStatus: OrganizationLifecycleStatus
    actorRole: OrganizationRole
    actorCanManageOrganization: boolean
    lifecycleAllowsDownstream: boolean
    lifecycleBlockerCode: Extract<OrganizationLifecycleReadinessBlockerCode, 'org_archived' | 'org_deleted'> | null
}): OrganizationLifecycleReadiness['workspaceBoundaryProof'] {
    return {
        schemaVersion: 'organization.workspace_boundary_readiness.v1',
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        lifecycleStatus: input.lifecycleStatus,
        actorRole: input.actorRole,
        routes: {
            createOrganization: 'POST /api/organizations',
            readOrganization: 'GET /api/organizations/:id',
            readSettings: 'GET /api/organizations/:id/settings',
            updateSettings: 'PUT /api/organizations/:id/settings',
            listMembers: 'GET /api/organizations/:id/members',
            listInvites: 'GET /api/organizations/:id/invites',
            listWatchlists: 'GET /api/organizations/:id/watchlists',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
        },
        roleGates: {
            readOrganization: organizationRolesFor('sharedWatchlistReaders'),
            updateSettings: organizationRolesFor('managers'),
            archiveOrganization: organizationRolesFor('managers'),
            deleteOrganization: organizationRolesFor('managers'),
            manageInvites: organizationRolesFor('managers'),
            mutateWatchlists: organizationRolesFor('watchlistEditors'),
            readSharedWatchlists: organizationRolesFor('sharedWatchlistReaders'),
        },
        actorPermissions: {
            canReadOrganization: true,
            canUpdateSettings: input.actorCanManageOrganization && input.lifecycleAllowsDownstream,
            canArchiveOrganization: input.actorCanManageOrganization && input.lifecycleAllowsDownstream,
            canDeleteOrganization: input.actorCanManageOrganization && input.lifecycleAllowsDownstream,
            canManageInvites: input.actorCanManageOrganization && input.lifecycleAllowsDownstream,
            canMutateWatchlists: input.actorCanManageOrganization && input.lifecycleAllowsDownstream,
            canReadSharedWatchlists: true,
            canReadAlertReadiness: true,
        },
        lifecycleMutationAllowed: input.lifecycleAllowsDownstream,
        blockedWhenInactive: input.lifecycleAllowsDownstream ? [] : [
            'PUT /api/organizations/:id/settings',
            'POST /api/organizations/:id/invites',
            'POST /api/organizations/:id/watchlists',
            'POST /api/organizations/:id/watchlists/:itemId/actions',
            'POST /api/organizations/:id/ownership-transfer',
        ],
        blockerCode: input.lifecycleBlockerCode,
        nonmemberEnumeration: false,
        noLeakFields: [
            'otherOrg.members',
            'otherOrg.invites',
            'otherOrg.watchlistItemIds',
            'destination.secret',
        ],
    }
}
