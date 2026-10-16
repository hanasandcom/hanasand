import { appendSharedAuditFilter } from '../inspectionFilterSql.ts'

type AddParameter = (value: string | number | Date | null) => string

type SystemEventFilters = {
    where: string[]
    add: AddParameter
    q: string
    org: string
    actor: string
    target: string
    action: string
    severity: string | null
    source: string
    service: string
    entity: string
    entityType: string
    request: string
    correlation: string
    idempotency: string
    supportSession: string
    workflow: string
    blocker: string
    reason: string
    scope: string
    context: string
    outcome: string | null
    from: string
    to: string
}

export function appendSystemEventFilters(input: SystemEventFilters) {
    const { where, add } = input
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push(`(
            e.event_type ILIKE ${placeholder}
            OR e.source ILIKE ${placeholder}
            OR e.service ILIKE ${placeholder}
            OR e.actor_id ILIKE ${placeholder}
            OR actor.name ILIKE ${placeholder}
            OR e.object_id ILIKE ${placeholder}
            OR target_user.name ILIKE ${placeholder}
            OR e.object_type ILIKE ${placeholder}
            OR e.organization_id ILIKE ${placeholder}
            OR organization.name ILIKE ${placeholder}
            OR e.subject_id ILIKE ${placeholder}
            OR e.request_id ILIKE ${placeholder}
            OR e.outcome ILIKE ${placeholder}
            OR e.reason ILIKE ${placeholder}
        )`)
    }
    if (input.org) appendSharedAuditFilter(where, add, 'e', 'organization', input.org)
    if (input.actor) {
        const placeholder = add(`%${input.actor}%`)
        where.push('(e.actor_id ILIKE ' + placeholder + ' OR actor.name ILIKE ' + placeholder + ')')
    }
    if (input.target) {
        const placeholder = add(`%${input.target}%`)
        where.push('(e.object_id ILIKE ' + placeholder + ' OR target_user.name ILIKE ' + placeholder + ' OR e.object_type ILIKE ' + placeholder + ')')
    }
    if (input.action) appendSharedAuditFilter(where, add, 'e', 'action', input.action)
    if (input.severity) appendSharedAuditFilter(where, add, 'e', 'severity', input.severity)
    if (input.source) appendSharedAuditFilter(where, add, 'e', 'source', input.source)
    if (input.service) appendSharedAuditFilter(where, add, 'e', 'service', input.service)
    if (input.entity) where.push(`e.subject_id ILIKE ${add(`%${input.entity}%`)}`)
    if (input.entityType) appendSharedAuditFilter(where, add, 'e', 'entityType', input.entityType)
    if (input.request) appendSharedAuditFilter(where, add, 'e', 'request', input.request)
    if (input.correlation) {
        const placeholder = add(`%${input.correlation}%`)
        where.push('(e.request_id ILIKE ' + placeholder + ' OR e.context->>\'correlationId\' ILIKE ' + placeholder + ')')
    }
    if (input.idempotency) where.push(`e.context->>'idempotencyKey' ILIKE ${add(`%${input.idempotency}%`)}`)
    if (input.supportSession) appendSharedAuditFilter(where, add, 'e', 'supportSession', input.supportSession)
    if (input.workflow) appendSharedAuditFilter(where, add, 'e', 'workflow', input.workflow)
    if (input.blocker) appendSharedAuditFilter(where, add, 'e', 'blocker', input.blocker)
    if (input.reason) appendSharedAuditFilter(where, add, 'e', 'reason', input.reason)
    if (input.scope) appendSharedAuditFilter(where, add, 'e', 'scope', input.scope)
    if (input.context) appendSharedAuditFilter(where, add, 'e', 'context', input.context)
    if (input.outcome) appendSharedAuditFilter(where, add, 'e', 'outcome', input.outcome)
    if (input.from && !Number.isNaN(Date.parse(input.from))) appendSharedAuditFilter(where, add, 'e', 'from', input.from)
    if (input.to && !Number.isNaN(Date.parse(input.to))) appendSharedAuditFilter(where, add, 'e', 'to', input.to)
}
