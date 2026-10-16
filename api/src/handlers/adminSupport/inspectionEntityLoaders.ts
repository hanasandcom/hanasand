import run from '#db'
import { supportSqlFilters } from './inspectionFilterSql.ts'

export const supportOrganizationSummaryColumns = `
    (
        SELECT COUNT(*)::int
        FROM organization_members active_members
        WHERE active_members.organization_id = o.id
          AND active_members.status = 'active'
    ) AS member_count,
    (
        SELECT COUNT(*)::int
        FROM organization_invites pending_invites
        WHERE pending_invites.organization_id = o.id
          AND pending_invites.status = 'pending'
    ) AS pending_invite_count
`

export const supportMemberInspectionColumns = `
    om.organization_id,
    organizations.name AS organization_name,
    organizations.slug AS organization_slug,
    om.user_id,
    users.name,
    users.avatar,
    users.active,
    users.deactivated_at,
    users.deletion_scheduled_at,
    om.role,
    om.status,
    om.invited_by,
    om.joined_at,
    om.created_at
`

export async function loadInspectionOrganizations(input: { q?: string, org: string, user: string, email: string, request: string, limit: number }) {
    const { where, values, add } = supportSqlFilters()
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(o.id ILIKE ' + placeholder + ' OR o.name ILIKE ' + placeholder + ' OR o.slug ILIKE ' + placeholder + ')')
    }
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push(`(
            o.id ILIKE ${placeholder}
            OR o.name ILIKE ${placeholder}
            OR o.slug ILIKE ${placeholder}
            OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = o.id AND om.user_id ILIKE ${placeholder})
            OR EXISTS (SELECT 1 FROM organization_invites invite WHERE invite.organization_id = o.id AND invite.email ILIKE ${placeholder})
            OR EXISTS (SELECT 1 FROM system_events event WHERE event.organization_id = o.id AND (event.event_type ILIKE ${placeholder} OR event.request_id ILIKE ${placeholder} OR event.subject_id ILIKE ${placeholder} OR event.reason ILIKE ${placeholder}))
        )`)
    }
    if (input.user) {
        where.push(`EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = o.id
              AND om.user_id ILIKE ${add(`%${input.user}%`)}
        )`)
    }
    if (input.email) {
        where.push(`EXISTS (
            SELECT 1 FROM organization_invites invite
            WHERE invite.organization_id = o.id
              AND lower(invite.email) = lower(${add(input.email)})
        )`)
    }
    if (input.request) {
        const placeholder = add(`%${input.request}%`)
        where.push(`(
            EXISTS (SELECT 1 FROM admin_access_recovery_approvals approval WHERE approval.organization_id = o.id AND approval.request_id ILIKE ${placeholder})
            OR EXISTS (SELECT 1 FROM system_events event WHERE event.organization_id = o.id AND event.request_id ILIKE ${placeholder})
        )`)
    }
    if (!where.length) return []

    const result = await run(`
        SELECT o.*, ${supportOrganizationSummaryColumns}
        FROM organizations o
        WHERE ${where.join('\n           OR ')}
        ORDER BY o.updated_at DESC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}

export async function loadInspectionUsers(input: { q?: string, user: string, request: string, limit: number }) {
    const { where, values, add } = supportSqlFilters()
    if (input.user) {
        const placeholder = add(`%${input.user}%`)
        where.push('(users.id ILIKE ' + placeholder + ' OR users.name ILIKE ' + placeholder + ')')
    }
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push('(users.id ILIKE ' + placeholder + ' OR users.name ILIKE ' + placeholder + ')')
    }
    if (input.request) {
        const placeholder = add(`%${input.request}%`)
        where.push(`(
            EXISTS (
                SELECT 1 FROM admin_access_recovery_approvals approval
                WHERE approval.request_id ILIKE ${placeholder}
                  AND users.id IN (approval.requested_by, approval.target_user_id, approval.approved_by, approval.denied_by)
            )
            OR EXISTS (
                SELECT 1 FROM system_events event
                WHERE event.request_id ILIKE ${placeholder}
                  AND users.id IN (event.actor_id, event.object_id)
            )
        )`)
    }
    if (!where.length) return []

    const result = await run(`
        SELECT id, name, avatar, active, reserved, deactivated_at, deactivated_by, deletion_requested_at, deletion_scheduled_at
        FROM users
        WHERE ${where.join('\n           OR ')}
        ORDER BY name ASC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}

export async function loadInspectionMemberships(input: { q?: string, org: string, user: string, request: string, limit: number }) {
    const { where, values, add } = supportSqlFilters()
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(om.organization_id ILIKE ' + placeholder + ' OR organizations.name ILIKE ' + placeholder + ' OR organizations.slug ILIKE ' + placeholder + ')')
    }
    if (input.user) where.push(`om.user_id ILIKE ${add(`%${input.user}%`)}`)
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push('(om.organization_id ILIKE ' + placeholder + ' OR organizations.name ILIKE ' + placeholder + ' OR organizations.slug ILIKE ' + placeholder + ' OR om.user_id ILIKE ' + placeholder + ' OR users.name ILIKE ' + placeholder + ' OR om.role ILIKE ' + placeholder + ' OR om.status ILIKE ' + placeholder + ')')
    }
    if (input.request) {
        const placeholder = add(`%${input.request}%`)
        where.push(`EXISTS (
            SELECT 1 FROM admin_access_recovery_approvals approval
            WHERE approval.request_id ILIKE ${placeholder}
              AND approval.organization_id = om.organization_id
              AND (approval.target_user_id = om.user_id OR approval.requested_by = om.user_id)
        )`)
    }
    if (!where.length) return []

    const result = await run(`
        SELECT ${supportMemberInspectionColumns}
        FROM organization_members om
        JOIN users ON users.id = om.user_id
        JOIN organizations ON organizations.id = om.organization_id
        WHERE ${where.join('\n           AND ')}
        ORDER BY organizations.name ASC, users.name ASC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}

export async function loadInspectionInvites(input: { q?: string, org: string, email: string, request: string, limit: number }) {
    const { where, values, add } = supportSqlFilters()
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(organization_invites.organization_id ILIKE ' + placeholder + ' OR organizations.name ILIKE ' + placeholder + ' OR organizations.slug ILIKE ' + placeholder + ')')
    }
    if (input.email) where.push(`lower(organization_invites.email) = lower(${add(input.email)})`)
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push('(organization_invites.id ILIKE ' + placeholder + ' OR organization_invites.email ILIKE ' + placeholder + ' OR organization_invites.role ILIKE ' + placeholder + ' OR organization_invites.status ILIKE ' + placeholder + ' OR organizations.name ILIKE ' + placeholder + ' OR organizations.slug ILIKE ' + placeholder + ')')
    }
    if (input.request) {
        const placeholder = add(`%${input.request}%`)
        where.push(`EXISTS (
            SELECT 1 FROM admin_access_recovery_approvals approval
            WHERE approval.request_id ILIKE ${placeholder}
              AND approval.invite_id = organization_invites.id
        )`)
    }
    if (!where.length) return []

    const result = await run(`
        SELECT organization_invites.*, organizations.name AS organization_name, organizations.slug AS organization_slug
        FROM organization_invites
        JOIN organizations ON organizations.id = organization_invites.organization_id
        WHERE ${where.join('\n           AND ')}
        ORDER BY organization_invites.status ASC, organization_invites.created_at DESC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}
