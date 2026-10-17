import { memberKey, nowRow, rows, iso } from './rowHelpers.ts'
import type { SmokeQueryHandler } from './queryTypes.ts'
import type { Row } from './state.ts'

export const handleInviteQueries: SmokeQueryHandler = (compact, params, state) => {
    if (compact.startsWith('SELECT * FROM organization_invites WHERE id = $1')) {
        const [inviteId, organizationId] = params
        const invite = state.invites.get(inviteId)
        if (!invite || organizationId && invite.organization_id !== organizationId) return rows([])
        return rows([invite])
    }

    if (compact.startsWith('SELECT COALESCE(status')) {
        const organization = state.organizations.get(params[0])
        return rows(organization ? [{ status: organization.status ?? 'active' }] : [])
    }

    if (compact.startsWith('SELECT * FROM organization_invites WHERE organization_id')) {
        if (compact.includes('lower(email) = lower($2)')) {
            const [organizationId, email] = params
            const invite = [...state.invites.values()].find(row => row.organization_id === organizationId && row.email.toLowerCase() === String(email).toLowerCase())
            return rows(invite ? [invite] : [])
        }
        return rows([...state.invites.values()].filter(invite => invite.organization_id === params[0] && invite.status === 'pending' && Date.parse(invite.expires_at) > Date.now()))
    }

    if (compact.startsWith('UPDATE organization_invites SET role = $3')) {
        const [organizationId, email, role, invitedBy, expiresAt] = params
        const existing = [...state.invites.values()].find(invite => invite.organization_id === organizationId && invite.email === email)
        if (!existing) return rows([])
        const updated = {
            ...existing,
            role,
            invited_by: invitedBy,
            status: 'pending',
            revoked_at: null,
            accepted_at: null,
            accepted_by: null,
            expires_at: expiresAt,
            created_at: iso(),
        }
        state.invites.set(updated.id, updated)
        return rows([updated])
    }

    if (compact.startsWith('INSERT INTO organization_invites')) {
        const [id, organizationId, email, role, invitedBy, expiresAt] = params
        const existing = [...state.invites.values()].find(invite => invite.organization_id === organizationId && invite.email === email)
        const invite = existing
            ? { ...existing, role, invited_by: invitedBy, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt, created_at: iso() }
            : nowRow({ id, organization_id: organizationId, email, role, invited_by: invitedBy, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt })
        state.invites.set(invite.id, invite)
        return rows([invite])
    }

    if (compact.startsWith('UPDATE organization_invites SET status = CASE WHEN $3')) {
        const [inviteId, organizationId, action, expiresAt] = params
        const existing = state.invites.get(inviteId)
        if (!existing || existing.organization_id !== organizationId || existing.status === 'accepted') return rows([])
        const updated = {
            ...existing,
            status: action === 'resend' ? 'pending' : 'revoked',
            revoked_at: action === 'revoke' ? iso() : null,
            accepted_at: null,
            accepted_by: null,
            expires_at: action === 'resend' ? expiresAt : existing.expires_at,
            created_at: action === 'resend' ? iso() : existing.created_at,
        }
        state.invites.set(inviteId, updated)
        return rows([updated])
    }

    if (compact.startsWith('UPDATE organization_invites SET status = \'pending\'')) {
        const [inviteId, organizationId, expiresAt] = params
        const existing = state.invites.get(inviteId)
        if (!existing || existing.organization_id !== organizationId || existing.status === 'accepted') return rows([])
        const updated = { ...existing, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt, created_at: iso() }
        state.invites.set(inviteId, updated)
        return rows([updated])
    }

    if (compact.startsWith('UPDATE organization_invites SET status = \'revoked\'') && compact.includes('FROM users')) {
        const [organizationId, userId] = params
        const user = state.users.get(userId)
        if (!user?.email) return rows([])
        const revoked: Row[] = []
        for (const invite of state.invites.values()) {
            if (invite.organization_id !== organizationId || invite.status !== 'pending' || invite.email.toLowerCase() !== user.email.toLowerCase()) continue
            const updated = { ...invite, status: 'revoked', accepted_at: null, accepted_by: null }
            state.invites.set(invite.id, updated)
            revoked.push(updated)
        }
        return rows(revoked)
    }

    if (compact.startsWith('UPDATE organization_invites SET status = \'revoked\'')) {
        const [inviteId, organizationId] = params
        const existing = state.invites.get(inviteId)
        if (!existing || existing.organization_id !== organizationId || existing.status === 'accepted') return rows([])
        const updated = { ...existing, status: 'revoked', accepted_at: null, accepted_by: null }
        state.invites.set(inviteId, updated)
        return rows([updated])
    }

    if (compact.startsWith('UPDATE organization_invites SET status = \'accepted\'')) {
        const [inviteId, userId] = params
        const invite = state.invites.get(inviteId)
        if (!invite || invite.status !== 'pending' || Date.parse(invite.expires_at) <= Date.now()) return rows([])
        const organization = state.organizations.get(invite.organization_id)
        if (!organization || (organization.status ?? 'active') !== 'active') return rows([])
        const acceptingUser = state.users.get(userId)
        if (!acceptingUser || acceptingUser.active === false) return rows([])
        const existingMember = state.members.get(memberKey(invite.organization_id, userId))
        if (existingMember?.status === 'removed') return rows([])
        const acceptedInvite = { ...invite, status: 'accepted', accepted_by: userId, accepted_at: iso(), revoked_at: null }
        state.invites.set(inviteId, acceptedInvite)
        return rows([acceptedInvite])
    }

    return undefined
}
