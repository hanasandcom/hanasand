import run from '#db'

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
