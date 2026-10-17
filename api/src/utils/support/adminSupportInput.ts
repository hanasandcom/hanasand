import type { FastifyRequest } from 'fastify'

export function supportText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

export function cleanContext(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 1000) : ''
}

export function supportInspectionAuditMetadata(req: FastifyRequest) {
    const query = req.query as Record<string, unknown>
    return {
        requestId: supportText(query.request || query.requestId) || supportRequestId(req),
        reason: supportText(query.reason),
        supportContext: cleanContext(query.context),
    }
}

export function supportInspectionAuditContext(input: { requestId: string, reason: string, supportContext: string }, extra: Record<string, unknown>) {
    return {
        schemaVersion: 'support.inspection.audit_context.v1',
        requestId: input.requestId,
        reasonProvided: Boolean(input.reason),
        supportContext: input.supportContext || null,
        redactionRequired: true,
        ...extra,
    }
}

export function supportRequestId(req: FastifyRequest) {
    const header = req.headers['x-request-id']
    if (Array.isArray(header)) return header[0] || req.id
    return header || req.id
}

export function headerText(value: string | string[] | undefined) {
    return Array.isArray(value) ? supportText(value[0]) : supportText(value)
}

export function supportSessionIdFromRequest(req: FastifyRequest, body: { supportSessionId?: unknown, support_session_id?: unknown } | undefined) {
    return supportText(headerText(req.headers['x-support-session-id']) || body?.supportSessionId || body?.support_session_id)
}

export function supportSessionIdFromAuditEvent(input: { context?: unknown, entityId?: unknown }) {
    const context = input.context && typeof input.context === 'object' && !Array.isArray(input.context)
        ? input.context as Record<string, unknown>
        : {}
    const explicitId = supportText(context.supportSessionId)
    if (explicitId) return explicitId

    const entityId = supportText(input.entityId)
    return entityId.startsWith('support_session_') ? entityId : ''
}

export function normalizeOption(value: unknown, allowed: string[]) {
    const normalized = supportText(value).toLowerCase()
    return allowed.includes(normalized) ? normalized : ''
}

export function supportInspectionQueryFilters(query: object, defaults: {
    action?: string
    source?: string
    service?: string
    limit?: number
    maxLimit?: number
} = {}) {
    const input = query as Record<string, unknown>
    const defaultLimit = defaults.limit ?? 50
    const parsedLimit = Number(input.limit || defaultLimit)
    return {
        q: supportText(input.q),
        org: supportText(input.org || input.orgId),
        user: supportText(input.user || input.userId),
        email: supportText(input.email).toLowerCase(),
        request: supportText(input.request || input.requestId),
        entity: supportText(input.entity || input.entityId),
        entityType: supportText(input.entityType),
        supportSession: supportText(input.session || input.supportSession || input.supportSessionId),
        workflow: supportText(input.workflow || input.bridgeWorkflow || input.sourceWorkflow),
        action: supportText(input.action || defaults.action),
        severity: normalizeOption(input.severity, ['info', 'notice', 'warning', 'critical']),
        outcome: normalizeOption(input.outcome, ['success', 'denied', 'failed']),
        source: supportText(input.source || defaults.source),
        service: supportText(input.service || defaults.service),
        blocker: supportText(input.blocker || input.blockerCode),
        reason: supportText(input.reason || input.supportReason),
        scope: supportText(input.scope || input.supportScope),
        context: supportText(input.context || input.supportContext),
        from: supportText(input.from),
        to: supportText(input.to),
        limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), defaults.maxLimit ?? 100) : defaultLimit,
    }
}

export function normalizeApprovalStatus(value: unknown) {
    const normalized = supportText(value).toLowerCase()
    if (normalized === 'pending_approval') return 'pending'
    return ['pending', 'approved', 'denied', 'not_required'].includes(normalized) ? normalized : ''
}

export function supportError(code: string, message: string, extra: Record<string, unknown> = {}) {
    return {
        error: message,
        detail: {
            schemaVersion: 'support.error.v1',
            code,
            outcome: 'denied',
            ...extra,
        },
    }
}
