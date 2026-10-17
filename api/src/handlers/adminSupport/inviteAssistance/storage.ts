import run from '#db'
import { supportText as text } from '#utils/support/adminSupportInput.ts'
import type { OrganizationInviteRow } from '#utils/organizations.ts'

export async function loadOrganizationInvitesByIds(organizationId: string, inviteIds: string[]) {
    if (!inviteIds.length) return []
    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE organization_id = $1
          AND id = ANY($2::text[])
        ORDER BY created_at DESC
    `, [organizationId, inviteIds])
    return result.rows as OrganizationInviteRow[]
}

export function auditContextInviteIds(context: Record<string, unknown>) {
    const direct = Array.isArray(context.inviteIds) ? context.inviteIds : []
    return direct.map(id => text(id)).filter(Boolean)
}
