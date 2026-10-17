import type { OrganizationSmokeState, Row } from './state.ts'

export function rows(resultRows: Row[]) {
    return { rows: resultRows, rowCount: resultRows.length }
}

export function memberKey(organizationId: string, userId: string) {
    return `${organizationId}:${userId}`
}

export function iso() {
    return new Date().toISOString()
}

export function nowRow(row: Row) {
    const at = iso()
    return { created_at: at, updated_at: at, ...row }
}

export function organizationRow(row: Row) {
    return nowRow({
        status: 'active',
        default_webhook_policy: 'active_destinations',
        alert_visibility_policy: 'members',
        retention_days: 365,
        audit_safe_metadata: {},
        ...row,
    })
}

export function organizationSummary(state: OrganizationSmokeState, organizationId: string, role: string) {
    const org = state.organizations.get(organizationId)
    const activeMembers = [...state.members.values()].filter(member => member.organization_id === organizationId && member.status === 'active' && state.users.get(member.user_id)?.active !== false)
    const activeOwners = activeMembers.filter(member => member.role === 'owner')
    const activeAdmins = activeMembers.filter(member => member.role === 'owner' || member.role === 'admin')
    const pendingInvites = [...state.invites.values()].filter(invite => invite.organization_id === organizationId && invite.status === 'pending' && Date.parse(invite.expires_at) > Date.now())
    const sharedWatchlists = [...state.watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at && item.status === 'active')
    return {
        ...org,
        role,
        member_count: activeMembers.length,
        owner_count: activeOwners.length,
        admin_count: activeAdmins.length,
        pending_invite_count: pendingInvites.length,
        shared_watchlist_count: sharedWatchlists.length,
    }
}
