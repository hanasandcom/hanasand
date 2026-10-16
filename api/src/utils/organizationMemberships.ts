import run from '#db'

export type OrganizationMembershipAvailability = {
    organizationId: string
    ownerCount: number
    activeOwnerCount: number
    adminCount: number
    activeAdminCount: number
    hasAvailableOwner: boolean
    hasAvailableAdmin: boolean
}

export async function organizationMembershipAvailability(organizationIds: string[], query: typeof run = run) {
    if (!organizationIds.length) return []

    const result = await query(`
        SELECT
            membership.organization_id,
            COUNT(*) FILTER (WHERE membership.role = 'owner' AND membership.status = 'active')::int AS owner_count,
            COUNT(*) FILTER (
                WHERE membership.role = 'owner'
                  AND membership.status = 'active'
                  AND owner.active IS TRUE
                  AND owner.deletion_scheduled_at IS NULL
            )::int AS active_owner_count,
            COUNT(*) FILTER (WHERE membership.role IN ('owner', 'admin') AND membership.status = 'active')::int AS admin_count,
            COUNT(*) FILTER (
                WHERE membership.role IN ('owner', 'admin')
                  AND membership.status = 'active'
                  AND owner.active IS TRUE
                  AND owner.deletion_scheduled_at IS NULL
            )::int AS active_admin_count
        FROM organization_members membership
        JOIN users owner ON owner.id = membership.user_id
        WHERE membership.organization_id = ANY($1::text[])
        GROUP BY membership.organization_id
    `, [organizationIds])

    return result.rows.map((row: Record<string, unknown>) => {
        const activeOwnerCount = Number(row.active_owner_count || 0)
        const activeAdminCount = Number(row.active_admin_count || 0)
        return {
            organizationId: String(row.organization_id),
            ownerCount: Number(row.owner_count || 0),
            activeOwnerCount,
            adminCount: Number(row.admin_count || 0),
            activeAdminCount,
            hasAvailableOwner: activeOwnerCount > 0,
            hasAvailableAdmin: activeAdminCount > 0,
        }
    }) as OrganizationMembershipAvailability[]
}

export async function activeOrganizationOwnerCount(organizationId: string, query: typeof run = run) {
    const result = await query(`
        SELECT COUNT(*)::int AS owner_count
        FROM organization_members membership
        JOIN users owner
          ON owner.id = membership.user_id
         AND owner.active IS TRUE
         AND owner.deletion_scheduled_at IS NULL
        WHERE membership.organization_id = $1
          AND membership.status = 'active'
          AND membership.role = 'owner'
    `, [organizationId])

    return Number(result.rows[0]?.owner_count ?? 0)
}
