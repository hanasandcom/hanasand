import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { OrganizationMemberRow, OrganizationRow } from '#utils/organizations.ts'

export async function loadOrganizationForMember(organizationId: string, userId: string, query: typeof run = run) {
    const result = await query(`
        SELECT
            o.*,
            om.role,
            active_member_counts.member_count,
            active_member_counts.owner_count,
            active_member_counts.admin_count,
            pending_invite_counts.pending_invite_count,
            watchlist_counts.shared_watchlist_count
        FROM organizations o
        JOIN organization_members om
          ON om.organization_id = o.id
         AND om.user_id = $2
         AND om.status = 'active'
        JOIN users current_member_user
          ON current_member_user.id = om.user_id
         AND current_member_user.active = TRUE
         AND current_member_user.deletion_scheduled_at IS NULL
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*)::int AS member_count,
                COUNT(*) FILTER (WHERE active_members.role = 'owner')::int AS owner_count,
                COUNT(*) FILTER (WHERE active_members.role IN ('owner', 'admin'))::int AS admin_count
            FROM organization_members active_members
            JOIN users active_member_users
              ON active_member_users.id = active_members.user_id
             AND active_member_users.active = TRUE
            WHERE active_members.organization_id = o.id
              AND active_members.status = 'active'
        ) active_member_counts ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS pending_invite_count
            FROM organization_invites pending_invites
            WHERE pending_invites.organization_id = o.id
              AND pending_invites.status = 'pending'
              AND pending_invites.expires_at > NOW()
        ) pending_invite_counts ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS shared_watchlist_count
            FROM organization_watchlist_items active_watchlist_items
            WHERE active_watchlist_items.organization_id = o.id
              AND active_watchlist_items.archived_at IS NULL
              AND active_watchlist_items.status = 'active'
        ) watchlist_counts ON TRUE
        WHERE o.id = $1
        LIMIT 1
    `, [organizationId, userId])

    return result.rows[0] as OrganizationRow | undefined
}

export async function loadOrganizationMemberRequest(
    req: FastifyRequest,
    res: FastifyReply,
    organizationId: string,
    unauthorizedBody?: { error: unknown },
) {
    const userId = await authenticateOrganizationRequest(req, res, unauthorizedBody)
    if (!userId) return null

    const organization = await loadOrganizationForMember(organizationId, userId)
    return { userId, organization }
}

export async function loadRequiredOrganizationMemberRequest(
    req: FastifyRequest,
    res: FastifyReply,
    organizationId: string,
) {
    const requestContext = await loadOrganizationMemberRequest(req, res, organizationId)
    if (!requestContext) return null
    const { organization } = requestContext
    if (!organization) {
        res.status(404).send({ error: 'Organization not found.' })
        return null
    }

    return { userId: requestContext.userId, organization }
}

export async function loadOrganizationMembership(organizationId: string, userId: string, query: typeof run = run) {
    const result = await query(`
        SELECT
            om.organization_id,
            om.user_id,
            u.name,
            u.avatar,
            om.role,
            om.status,
            om.invited_by,
            om.joined_at,
            om.created_at
        FROM organization_members om
        JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1
          AND om.user_id = $2
        LIMIT 1
    `, [organizationId, userId])

    return result.rows[0] as OrganizationMemberRow | undefined
}

export async function authenticateOrganizationRequest(
    req: FastifyRequest,
    res: FastifyReply,
    unauthorizedBody: { error: unknown } = { error: 'Unauthorized.' }
) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        res.status(401).send(unauthorizedBody)
        return null
    }

    return userId
}

export async function uniqueOrganizationSlug(baseSlug: string, currentOrganizationId?: string) {
    const result = await run(`
        SELECT id, slug
        FROM organizations
        WHERE (slug = $1 OR slug LIKE $2)
          AND ($3::text IS NULL OR id <> $3)
    `, [baseSlug, `${baseSlug}-%`, currentOrganizationId ?? null])
    const existing = new Set(result.rows.map((row: { slug: string }) => row.slug))
    if (!existing.has(baseSlug)) return baseSlug

    let suffix = 2
    while (existing.has(`${baseSlug}-${suffix}`)) suffix += 1
    return `${baseSlug}-${suffix}`
}
