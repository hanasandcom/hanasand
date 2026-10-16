import run from '#db'
import type { OrganizationRow } from '#utils/organizations.ts'
import { supportMemberInspectionColumns, supportOrganizationSummaryColumns } from '../inspectionEntityLoaders.ts'

export async function loadOrganizationSupportDetail(organizationId: string) {
    const result = await run(`
        SELECT o.*, ${supportOrganizationSummaryColumns}
        FROM organizations o
        WHERE o.id = $1
        LIMIT 1
    `, [organizationId])

    return result.rows[0] as OrganizationRow | undefined
}

export async function loadSupportMemberDetail(organizationId: string, userId: string, query: typeof run = run, lock = false) {
    const result = await query(`
        SELECT ${supportMemberInspectionColumns}
        FROM organization_members om
        JOIN users ON users.id = om.user_id
        JOIN organizations ON organizations.id = om.organization_id
        WHERE om.organization_id = $1
          AND om.user_id = $2
        LIMIT 1${lock ? '\n        FOR UPDATE OF om' : ''}
    `, [organizationId, userId])
    return result.rows[0] as Record<string, unknown> | undefined
}

export async function loadSupportOrganizationEntityAuditRows(input: {
    organizationId: string
    targetId: string
    kind: 'invite' | 'member'
}) {
    const targetPredicates = input.kind === 'invite'
        ? 'event.context->>\'inviteId\' = $2 OR event.context->\'inviteIds\' ? $2'
        : 'event.context->>\'targetUserId\' = $2 OR event.context->>\'memberId\' = $2'
    const result = await run(`
        SELECT
            event.id,
            event.event_type,
            event.severity,
            event.source,
            event.service,
            event.actor_id,
            actor.name AS actor_name,
            event.object_type,
            event.object_id,
            target_user.name AS target_name,
            event.organization_id,
            organization.name AS organization_name,
            event.subject_id,
            event.request_id,
            event.outcome,
            event.reason,
            event.context,
            event.created_at
        FROM system_events event
        LEFT JOIN users actor ON actor.id = event.actor_id
        LEFT JOIN users target_user ON target_user.id = event.object_id
        LEFT JOIN organizations organization ON organization.id = event.organization_id
        WHERE event.organization_id = $1
          AND (
              event.subject_id = $2
              OR event.object_id = $2
              OR ${targetPredicates}
          )
        ORDER BY event.created_at DESC
        LIMIT 25
    `, [input.organizationId, input.targetId])
    return result.rows as Record<string, unknown>[]
}
