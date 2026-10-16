import { compileAuditQuery } from '#utils/auditQuery.ts'
import { normalizeOption, supportError, supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterValidationError } from '#utils/support/auditFilterValidation.ts'
import { appendSystemEventFilters } from './systemEventFilters.ts'
import { systemEventFilters } from './auditFilterDefinitions.ts'

export type SystemEventQuery = {
    format?: string
    hql?: string
    q?: string
    org?: string
    orgId?: string
    organizationId?: string
    actor?: string
    actorId?: string
    supportActor?: string
    supportActorId?: string
    target?: string
    targetId?: string
    user?: string
    userId?: string
    targetUserId?: string
    action?: string
    actionType?: string
    severity?: string
    source?: string
    service?: string
    entity?: string
    entityId?: string
    entityType?: string
    request?: string
    requestId?: string
    correlation?: string
    correlationId?: string
    idempotency?: string
    idempotencyKey?: string
    idempotency_key?: string
    session?: string
    supportSession?: string
    supportSessionId?: string
    workflow?: string
    bridgeWorkflow?: string
    sourceWorkflow?: string
    blocker?: string
    blockerCode?: string
    reason?: string
    supportReason?: string
    scope?: string
    supportScope?: string
    context?: string
    supportContext?: string
    outcome?: string
    from?: string
    to?: string
    limit?: string
    cursor?: string
    page?: string
}

type CompiledAuditQuery = ReturnType<typeof compileAuditQuery>
type Cursor = { createdAt: string, id: number }
type QueryValues = Array<string | number | Date | null>

export type SystemEventSearchPlan = {
    compiled?: CompiledAuditQuery
    where: string[]
    values: QueryValues
    add: (value: string | number | Date | null) => string
    q: string
    org: string
    actorFilter: string
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
    contextFilter: string
    outcome: string | null
    from: string
    to: string
    limit: number
    page: number
    cursor: Cursor | null
}

export function prepareSystemEventSearch(query: SystemEventQuery): SystemEventSearchPlan | { error: unknown } {
    let compiled: CompiledAuditQuery | undefined
    try {
        if (query.hql !== undefined) compiled = compileAuditQuery(text(query.hql))
    } catch (error) {
        return { error: supportError('invalid_hql', error instanceof Error ? error.message : 'Invalid HQL query.') }
    }
    if (compiled && (query.cursor || query.page)) {
        return { error: supportError('invalid_hql', 'Use take to limit HQL results, without page or cursor.') }
    }

    const where: string[] = [...(compiled?.where || [])]
    const values: QueryValues = [...(compiled?.params || [])]
    const add = (value: string | number | Date | null) => {
        values.push(value)
        return `$${values.length}`
    }
    const q = text(query.q)
    const org = text(query.org || query.orgId || query.organizationId)
    const actorFilter = text(query.actor || query.actorId || query.supportActor || query.supportActorId)
    const target = text(query.target || query.targetId || query.user || query.userId || query.targetUserId)
    const action = text(query.action || query.actionType)
    const severity = normalizeOption(query.severity, ['info', 'notice', 'warning', 'critical'])
    const source = text(query.source)
    const service = text(query.service)
    const entity = text(query.entity || query.entityId)
    const entityType = text(query.entityType)
    const request = text(query.request || query.requestId)
    const correlation = text(query.correlation || query.correlationId)
    const idempotency = text(query.idempotency || query.idempotencyKey || query.idempotency_key)
    const supportSession = text(query.session || query.supportSession || query.supportSessionId)
    const workflow = text(query.workflow || query.bridgeWorkflow || query.sourceWorkflow)
    const blocker = text(query.blocker || query.blockerCode)
    const reason = text(query.reason || query.supportReason)
    const scope = text(query.scope || query.supportScope)
    const contextFilter = text(query.context || query.supportContext)
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 200)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500) : 200
    const page = Number(query.page || 1)
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * limit) || (query.page !== undefined && text(query.cursor))) {
        return { error: supportError('invalid_page', 'Page must be a positive whole number; use page without cursor.') }
    }
    const cursor = decodeAuditCursor(text(query.cursor))
    if (text(query.cursor) && !cursor) {
        return { error: supportError('invalid_audit_cursor', 'Audit cursor is invalid.') }
    }
    const filterError = systemEventFilterError(query, { severity, outcome, from, to, limit })
    if (filterError) return { error: filterError }

    appendSystemEventFilters({
        where, add, q, org, actor: actorFilter, target, action, severity, source, service,
        entity, entityType, request, correlation, idempotency, supportSession, workflow,
        blocker, reason, scope, context: contextFilter, outcome, from, to,
    })
    return {
        compiled, where, values, add, q, org, actorFilter, target, action, severity, source,
        service, entity, entityType, request, correlation, idempotency, supportSession,
        workflow, blocker, reason, scope, contextFilter, outcome, from, to, limit, page, cursor,
    }
}

export function encodeAuditCursor(createdAt: unknown, id: unknown) {
    return encodeURIComponent(JSON.stringify({ createdAt: new Date(String(createdAt)).toISOString(), id: Number(id) }))
}

function decodeAuditCursor(value: string): Cursor | null {
    if (!value) return null
    try {
        const parsed = JSON.parse(decodeURIComponent(value)) as { createdAt?: unknown, id?: unknown }
        const createdAt = new Date(String(parsed.createdAt || ''))
        const id = Number(parsed.id)
        if (!Number.isFinite(createdAt.getTime()) || !Number.isSafeInteger(id) || id <= 0) return null
        return { createdAt: createdAt.toISOString(), id }
    } catch {
        return null
    }
}

function systemEventFilterError(rawQuery: SystemEventQuery, filter: { severity: string | null, outcome: string | null, from: string, to: string, limit: number }) {
    return auditFilterValidationError(rawQuery, filter as { severity: string, outcome: string, from: string, to: string, limit: number }, {
        supportedFilters: systemEventFilters,
        unsupportedCode: 'unsupported_audit_filter',
        unsupportedLabel: 'audit',
        invalidCode: 'invalid_audit_filter',
        dateLabel: 'audit',
        limitMessage: 'Audit limit must be a positive number.',
    })
}
