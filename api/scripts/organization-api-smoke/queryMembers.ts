import { memberKey, nowRow, rows, iso } from './rowHelpers.ts'
import type { SmokeQueryHandler } from './queryTypes.ts'

export const handleMemberQueries: SmokeQueryHandler = (compact, params, state) => {
    if (compact.startsWith('SELECT status FROM organization_members')) {
        const member = state.members.get(memberKey(params[0], params[1]))
        return rows(member ? [{ status: member.status }] : [])
    }

    if (compact.startsWith('SELECT COALESCE(active, TRUE) AS active FROM users')) {
        const user = state.users.get(params[0])
        return rows(user ? [{ active: user.active !== false }] : [])
    }

    if (compact.startsWith('UPDATE organization_members SET role = CASE')) {
        const [organizationId, userId, invitedRole, status, invitedBy, joinedAt] = params
        const key = memberKey(organizationId, userId)
        const existing = state.members.get(key)
        if (!existing) return rows([])
        const role = existing.role === 'owner' || existing.role === 'admin' && ['editor', 'reader', 'member', 'viewer'].includes(invitedRole)
            ? existing.role
            : existing.role === 'editor' && ['reader', 'member', 'viewer'].includes(invitedRole)
                ? existing.role
                : invitedRole
        const updated = {
            ...existing,
            role,
            status,
            removed_at: status === 'active' ? null : existing.removed_at,
            invited_by: invitedBy,
            joined_at: joinedAt || iso(),
        }
        state.members.set(key, updated)
        return rows([updated])
    }

    if (compact.startsWith('INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, joined_at)')) {
        const [organizationId, userId, role, status, invitedBy, joinedAt] = params
        const member = nowRow({ organization_id: organizationId, user_id: userId, role, status, invited_by: invitedBy, joined_at: joinedAt || iso() })
        state.members.set(memberKey(organizationId, userId), member)
        return rows([member])
    }

    if (compact.includes('FROM organization_members om JOIN users u') && compact.includes('AND om.user_id = $2')) {
        const member = state.members.get(memberKey(params[0], params[1]))
        return rows(member
            ? [{ ...member, name: state.users.get(member.user_id)?.name ?? member.user_id, avatar: state.users.get(member.user_id)?.avatar ?? '' }]
            : [])
    }

    if (compact.startsWith('SELECT u.id AS user_id, COALESCE(u.active, TRUE) AS user_active')) {
        const [organizationId, email] = params
        const user = [...state.users.values()].find(row => row.email?.toLowerCase() === String(email).toLowerCase())
        if (!user) return rows([])
        const member = state.members.get(memberKey(organizationId, user.id))
        return rows([{
            user_id: user.id,
            user_active: user.active !== false,
            member_role: member?.role ?? null,
            member_status: member?.status ?? null,
        }])
    }

    if (compact.includes('FROM organization_members om JOIN users u')) {
        return rows([...state.members.values()]
            .filter(member => member.organization_id === params[0] && member.status === 'active')
            .map(member => ({ ...member, name: state.users.get(member.user_id)?.name ?? member.user_id, avatar: state.users.get(member.user_id)?.avatar ?? '' })))
    }

    if (compact.startsWith('SELECT COUNT(*)::int AS owner_count FROM organization_members')) {
        return rows([{
            owner_count: [...state.members.values()].filter(member =>
                member.organization_id === params[0]
                && member.status === 'active'
                && member.role === 'owner'
                && state.users.get(member.user_id)?.active !== false
                && !state.users.get(member.user_id)?.deletion_scheduled_at
            ).length,
        }])
    }

    if (compact.startsWith('UPDATE organization_members SET status')) {
        const [organizationId, userId] = params
        const key = memberKey(organizationId, userId)
        const existing = state.members.get(key)
        if (!existing || existing.status !== 'active') return rows([])
        const removed = { ...existing, status: 'removed' }
        state.members.set(key, removed)
        return rows([{ ...removed, name: state.users.get(userId)?.name ?? userId, avatar: state.users.get(userId)?.avatar ?? '' }])
    }

    if (compact.startsWith('UPDATE organization_members SET role = $3')) {
        const [organizationId, userId, role] = params
        const key = memberKey(organizationId, userId)
        const existing = state.members.get(key)
        if (!existing || existing.status !== 'active') return rows([])
        const updated = { ...existing, role }
        state.members.set(key, updated)
        return rows([{ ...updated, name: state.users.get(userId)?.name ?? userId, avatar: state.users.get(userId)?.avatar ?? '' }])
    }

    if (compact.startsWith('UPDATE organization_members SET role = \'owner\'')) {
        const [organizationId, userId] = params
        const key = memberKey(organizationId, userId)
        const existing = state.members.get(key)
        if (!existing || existing.status !== 'active') return rows([])
        const updated = { ...existing, role: 'owner' }
        state.members.set(key, updated)
        return rows([{ ...updated, name: state.users.get(userId)?.name ?? userId, avatar: state.users.get(userId)?.avatar ?? '' }])
    }

    if (compact.startsWith('UPDATE organization_members SET role = \'admin\'')) {
        const [organizationId, userId] = params
        const key = memberKey(organizationId, userId)
        const existing = state.members.get(key)
        if (!existing || existing.status !== 'active' || existing.role !== 'owner') return rows([])
        state.members.set(key, { ...existing, role: 'admin' })
        return rows([{ user_id: userId }])
    }

    if (compact.includes('WITH promoted AS') || compact.includes('WITH viable_target AS')) {
        return promoteOwner(params, state)
    }

    return undefined
}

function promoteOwner(params: any[], state: Parameters<SmokeQueryHandler>[2]) {
    const [organizationId, targetUserId, previousOwnerId] = params
    const targetKey = memberKey(organizationId, targetUserId)
    const previousOwnerKey = memberKey(organizationId, previousOwnerId)
    const target = state.members.get(targetKey)
    const targetUser = state.users.get(targetUserId)
    const previousOwnerUser = state.users.get(previousOwnerId)
    if (!target || target.status !== 'active' || targetUser?.active === false || targetUser?.deletion_scheduled_at || previousOwnerUser?.active === false || previousOwnerUser?.deletion_scheduled_at) return rows([])
    const promoted = { ...target, role: 'owner' }
    state.members.set(targetKey, promoted)
    const previousOwner = state.members.get(previousOwnerKey)
    if (previousOwner?.status === 'active' && previousOwner.role === 'owner') {
        state.members.set(previousOwnerKey, { ...previousOwner, role: 'admin' })
    }
    return rows([{ ...promoted, name: state.users.get(targetUserId)?.name ?? targetUserId, avatar: state.users.get(targetUserId)?.avatar ?? '' }])
}
