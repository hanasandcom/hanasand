import { roleCanEditOrganization, type OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationAlertCaseAction, OrganizationAlertCaseRole } from '../inputTypes.ts'

const organizationRoleGates = {
    managers: ['owner', 'admin'],
    watchlistEditors: ['owner', 'admin', 'editor'],
    sharedWatchlistReaders: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
    alertCaseActors: ['owner', 'admin', 'editor', 'analyst'],
    supportTimelineReaders: ['owner', 'admin', 'support'],
    adminAssignableRoles: ['editor', 'reader'],
} as const

export function organizationRolesFor<TGate extends keyof typeof organizationRoleGates>(gate: TGate) {
    return [...organizationRoleGates[gate]]
}

export function roleCanWriteWatchlist(role: OrganizationRole | undefined) {
    return roleCanEditOrganization(role)
}

const organizationAlertCaseRoleGates = {
    create_watchlist: organizationRolesFor('watchlistEditors'),
    edit_watchlist_terms: organizationRolesFor('watchlistEditors'),
    archive_watchlist: organizationRolesFor('watchlistEditors'),
    restore_watchlist: organizationRolesFor('watchlistEditors'),
    acknowledge_alert: organizationRolesFor('alertCaseActors'),
    assign_case: organizationRolesFor('alertCaseActors'),
    link_case: organizationRolesFor('alertCaseActors'),
    manage_invites: organizationRolesFor('managers'),
} satisfies Record<OrganizationAlertCaseAction, OrganizationAlertCaseRole[]>

const organizationAlertCaseActionOrder = Object.keys(organizationAlertCaseRoleGates) as OrganizationAlertCaseAction[]

export function organizationAlertCaseRoleActions(role: OrganizationAlertCaseRole | undefined): OrganizationAlertCaseAction[] {
    if (!role) return []
    return organizationAlertCaseActionOrder.filter(action => organizationAlertCaseRoleGates[action].some(allowedRole => allowedRole === role))
}

function copyOrganizationAlertCaseRoleGates() {
    return Object.fromEntries(organizationAlertCaseActionOrder.map(action => [
        action,
        [...organizationAlertCaseRoleGates[action]],
    ])) as Record<OrganizationAlertCaseAction, OrganizationAlertCaseRole[]>
}

export function organizationAlertCaseRoleActionContract(member: { userId: string, role: OrganizationRole }) {
    return {
        schemaVersion: 'organization.alert_case_role_actions.v1' as const,
        actor: {
            userId: member.userId,
            role: member.role,
            status: 'active' as const,
            allowedActions: organizationAlertCaseRoleActions(member.role),
        },
        roleGates: copyOrganizationAlertCaseRoleGates(),
        lifecycleDenials: {
            nonmember: 'nonmember_denied' as const,
            revokedMember: 'member_revoked' as const,
            expiredInvite: 'invite_expired' as const,
            pausedWatchlist: 'watchlist_paused' as const,
            archivedWatchlist: 'watchlist_archived' as const,
            supportOnlyAccess: 'support_only_access' as const,
        },
    }
}
