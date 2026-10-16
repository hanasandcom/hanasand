import run from '#db'
import { appendSharedAuditFilter, supportSqlFilters } from './inspectionFilterSql.ts'
import type { AccessRecoveryApprovalRow } from './supportTypes.ts'

export async function loadInspectionApprovals(input: { q?: string, org: string, user: string, email: string, request: string, outcome: string, limit: number }) {
    const { where, values, add } = supportSqlFilters()
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(approval.organization_id ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
    if (input.user) {
        const placeholder = add(`%${input.user}%`)
        where.push('(approval.target_user_id ILIKE ' + placeholder + ' OR approval.requested_by ILIKE ' + placeholder + ' OR approval.approved_by ILIKE ' + placeholder + ' OR approval.denied_by ILIKE ' + placeholder + ')')
    }
    if (input.email) where.push(`lower(invite.email) = lower(${add(input.email)})`)
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push('(approval.request_id ILIKE ' + placeholder + ' OR approval.requested_reason ILIKE ' + placeholder + ' OR approval.decision_reason ILIKE ' + placeholder + ' OR invite.email ILIKE ' + placeholder + ' OR invite.status ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
    if (input.request) where.push(`approval.request_id ILIKE ${add(`%${input.request}%`)}`)
    if (input.outcome) where.push(`approval.outcome = ${add(input.outcome)}`)
    if (!where.length) return []

    const result = await run(`
        SELECT
            approval.*,
            invite.email,
            invite.role,
            invite.status AS invite_status,
            organization.name AS organization_name,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', event.id,
                    'actionType', event.event_type,
                    'outcome', event.outcome,
                    'severity', event.severity,
                    'createdAt', event.created_at
                ) ORDER BY event.created_at ASC)
                FROM system_events event
                WHERE event.request_id = approval.request_id
                  AND event.event_type ILIKE 'support.organization.access_recovery%'
            ), '[]'::jsonb) AS audit_events
        FROM admin_access_recovery_approvals approval
        JOIN organization_invites invite ON invite.id = approval.invite_id
        LEFT JOIN organizations organization ON organization.id = approval.organization_id
        WHERE ${where.join('\n           AND ')}
        ORDER BY approval.updated_at DESC, approval.created_at DESC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as AccessRecoveryApprovalRow[]
}

export async function loadInspectionAuditEvents(input: { q: string, org: string, user: string, email: string, request: string, entity: string, entityType: string, supportSession: string, workflow?: string, action: string, severity: string, outcome: string, source: string, service: string, blocker: string, reason: string, scope?: string, context: string, from: string, to: string, limit: number }) {
    const { where, values, add } = supportSqlFilters()
    if (input.org) appendSharedAuditFilter(where, add, 'event', 'organization', input.org)
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push(`(
            event.event_type ILIKE ${placeholder}
            OR event.actor_id ILIKE ${placeholder}
            OR event.object_id ILIKE ${placeholder}
            OR event.object_type ILIKE ${placeholder}
            OR event.organization_id ILIKE ${placeholder}
            OR organization.name ILIKE ${placeholder}
            OR organization.slug ILIKE ${placeholder}
            OR event.subject_id ILIKE ${placeholder}
            OR event.request_id ILIKE ${placeholder}
            OR event.outcome ILIKE ${placeholder}
            OR event.reason ILIKE ${placeholder}
            OR event.context::text ILIKE ${placeholder}
        )`)
    }
    if (input.user) {
        const placeholder = add(`%${input.user}%`)
        where.push('(event.actor_id ILIKE ' + placeholder + ' OR event.object_id ILIKE ' + placeholder + ' OR event.subject_id ILIKE ' + placeholder + ')')
    }
    if (input.email) {
        const placeholder = add(`%${input.email}%`)
        where.push('(event.object_id ILIKE ' + placeholder + ' OR event.context->>\'email\' ILIKE ' + placeholder + ')')
    }
    if (input.request) appendSharedAuditFilter(where, add, 'event', 'request', input.request)
    if (input.entity) {
        const placeholder = add(`%${input.entity}%`)
        where.push('(event.subject_id ILIKE ' + placeholder + ' OR event.object_id ILIKE ' + placeholder + ' OR event.context->>\'inviteId\' ILIKE ' + placeholder + ')')
    }
    if (input.supportSession) appendSharedAuditFilter(where, add, 'event', 'supportSession', input.supportSession)
    if (input.workflow) appendSharedAuditFilter(where, add, 'event', 'workflow', input.workflow)
    if (input.entityType) appendSharedAuditFilter(where, add, 'event', 'entityType', input.entityType)
    if (input.action) appendSharedAuditFilter(where, add, 'event', 'action', input.action)
    if (input.severity) appendSharedAuditFilter(where, add, 'event', 'severity', input.severity)
    if (input.outcome) appendSharedAuditFilter(where, add, 'event', 'outcome', input.outcome)
    if (input.source) appendSharedAuditFilter(where, add, 'event', 'source', input.source)
    if (input.service) appendSharedAuditFilter(where, add, 'event', 'service', input.service)
    if (input.blocker) appendSharedAuditFilter(where, add, 'event', 'blocker', input.blocker)
    if (input.reason) appendSharedAuditFilter(where, add, 'event', 'reason', input.reason)
    if (input.scope) appendSharedAuditFilter(where, add, 'event', 'scope', input.scope)
    if (input.context) appendSharedAuditFilter(where, add, 'event', 'context', input.context)
    if (input.from && !Number.isNaN(Date.parse(input.from))) appendSharedAuditFilter(where, add, 'event', 'from', input.from)
    if (input.to && !Number.isNaN(Date.parse(input.to))) appendSharedAuditFilter(where, add, 'event', 'to', input.to)
    if (!where.length) return []

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
        WHERE ${where.join('\n           AND ')}
        ORDER BY event.created_at DESC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}
