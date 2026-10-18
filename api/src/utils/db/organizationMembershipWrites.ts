import run from '#db'
import type { IdentityQuery } from './identityQueryTypes.ts'
import { updateThenInsert } from './updateThenInsert.ts'

export function touchOrganization(organizationId: string, query: IdentityQuery = run) {
    return query('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organizationId])
}

export async function upsertOrganizationMember(input: {
    organizationId: string
    userId: string
    role: string
    status?: 'active' | 'removed'
    invitedBy: string | null
    joinedAt?: Date | string
}, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE organization_members
           SET role = CASE
                   WHEN role = 'owner' THEN 'owner'
                   WHEN role = 'admin' AND $3 IN ('editor', 'reader', 'member', 'viewer') THEN 'admin'
                   WHEN role = 'editor' AND $3 IN ('reader', 'member', 'viewer') THEN 'editor'
                   ELSE $3
               END,
               status = $4,
               removed_at = CASE WHEN $4 = 'active' THEN NULL ELSE removed_at END,
               invited_by = $5,
               joined_at = COALESCE($6::timestamptz, NOW())
         WHERE organization_id = $1 AND user_id = $2
        RETURNING *
    `, [input.organizationId, input.userId, input.role, input.status ?? 'active', input.invitedBy, input.joinedAt ?? null])

    const result = await updateThenInsert(update, () => query(`
            INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, joined_at)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
            RETURNING *
        `, [input.organizationId, input.userId, input.role, input.status ?? 'active', input.invitedBy, input.joinedAt ?? null]))
    return result.rows[0]
}

export async function updateActiveOrganizationMemberRole(input: {
    organizationId: string
    userId: string
    role: string
}, query: IdentityQuery = run) {
    const updated = await query(`
        UPDATE organization_members
           SET role = $3
         WHERE organization_id = $1
           AND user_id = $2
           AND status = 'active'
        RETURNING *
    `, [input.organizationId, input.userId, input.role])
    const member = updated.rows[0]
    if (!member) return null

    await touchOrganization(input.organizationId, query)
    return member
}

export async function upsertOrganizationInvite(input: {
    id: string
    organizationId: string
    email: string
    role: string
    invitedBy: string
    expiresAt: Date | string
}, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE organization_invites
           SET role = $3,
               invited_by = $4,
               status = 'pending',
               revoked_at = NULL,
               accepted_at = NULL,
               accepted_by = NULL,
               expires_at = $5,
               created_at = NOW()
         WHERE organization_id = $1 AND email = $2
        RETURNING *
    `, [input.organizationId, input.email, input.role, input.invitedBy, input.expiresAt])

    const result = await updateThenInsert(update, () => query(`
            INSERT INTO organization_invites (id, organization_id, email, role, invited_by, status, expires_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6)
            RETURNING *
        `, [input.id, input.organizationId, input.email, input.role, input.invitedBy, input.expiresAt]))
    return result.rows[0]
}

export async function updateOrganizationInviteAction(input: {
    organizationId: string
    inviteId: string
    action: 'revoke' | 'resend'
    expiresAt?: Date | string
}, query: IdentityQuery = run) {
    const result = await query(`
        UPDATE organization_invites
           SET status = CASE WHEN $3 = 'resend' THEN 'pending' ELSE 'revoked' END,
               revoked_at = CASE WHEN $3 = 'revoke' THEN NOW() ELSE NULL END,
               accepted_at = NULL,
               accepted_by = NULL,
               expires_at = CASE WHEN $3 = 'resend' THEN $4 ELSE expires_at END,
               created_at = CASE WHEN $3 = 'resend' THEN NOW() ELSE created_at END
         WHERE id = $1
           AND organization_id = $2
           AND status <> 'accepted'
        RETURNING *
    `, [input.inviteId, input.organizationId, input.action, input.expiresAt ?? null])
    return result.rows[0] ?? null
}
