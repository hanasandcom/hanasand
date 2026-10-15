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

export function normalizeSupportSessionActions(value: unknown): { value: string[], error: Record<string, unknown> | null } {
    const allowed = new Set(['invite_assist', 'invite_resend', 'invite_revoke', 'member_role_recovery', 'access_recovery', 'impersonation'])
    const actions = normalizeSupportValueList(value, ['invite_assist', 'invite_resend', 'invite_revoke', 'member_role_recovery'])
    const unsupported = actions.filter(action => !allowed.has(action))
    if (unsupported.length) {
        return { value: [], error: supportError('invalid_scope', `Unsupported support session action: ${unsupported[0]}.`, { supportedActions: Array.from(allowed) }) }
    }
    return { value: actions, error: null }
}

export function normalizeSupportSessionScope(value: unknown): { value: string[], error: Record<string, unknown> | null } {
    const allowed = new Set(['invite:create', 'invite:resend', 'invite:revoke', 'member:role_recovery', 'recovery:invite', 'recovery:approve', 'recovery:deny', 'read_profile', 'read_org', 'support_debug'])
    const scope = normalizeSupportValueList(value, ['invite:create', 'invite:resend', 'invite:revoke', 'member:role_recovery'])
    const unsupported = scope.filter(item => !allowed.has(item))
    if (unsupported.length) {
        return { value: [], error: supportError('invalid_scope', `Unsupported support session scope: ${unsupported[0]}.`, { supportedScopes: Array.from(allowed) }) }
    }
    return { value: scope, error: null }
}

export function normalizeSupportPreparationScope(value: unknown, action: string): { value: string[], error: Record<string, unknown> | null } {
    const allowedByAction: Record<string, string[]> = {
        invite_assist: ['invite:create', 'invite:resend', 'invite:revoke'],
        access_recovery: ['recovery:invite', 'recovery:approve', 'recovery:deny'],
        member_role_recovery: ['member:role_recovery'],
        impersonation: ['read_profile', 'read_org', 'support_debug'],
    }
    const allowed = new Set(allowedByAction[action] || [])
    const scope = normalizeSupportValueList(value)
    if (!scope.length) {
        return { value: [], error: supportError('missing_scope', 'Support action preparation scope is required.', { supportedScopes: Array.from(allowed) }) }
    }
    const unsupported = scope.filter(item => !allowed.has(item))
    if (unsupported.length) {
        return { value: [], error: supportError('invalid_scope', `Unsupported support action scope: ${unsupported[0]}.`, { supportedScopes: Array.from(allowed) }) }
    }
    return { value: scope, error: null }
}

export function normalizeSupportPreparationDuration(value: unknown, action: string): { value: number | null, error: Record<string, unknown> | null } {
    if (action !== 'impersonation' && (value === undefined || value === null || value === '')) {
        return { value: null, error: null }
    }
    if (value === undefined || value === null || value === '') {
        return { value: null, error: supportError('invalid_duration', 'Impersonation preparation duration is required.') }
    }
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed !== Math.trunc(parsed) || parsed < 5 || parsed > 240) {
        return { value: null, error: supportError('invalid_duration', 'Impersonation preparation duration must be between 5 and 240 minutes.') }
    }
    return { value: parsed, error: null }
}

export function normalizeSupportPreparationExpiry(value: unknown): { value: string | null, error: Record<string, unknown> | null } {
    const expiresAt = supportText(value)
    if (!expiresAt) {
        return { value: null, error: null }
    }
    const timestamp = Date.parse(expiresAt)
    if (Number.isNaN(timestamp) || timestamp <= Date.now()) {
        return { value: null, error: supportError('invalid_expiry', 'Support action preparation expiry must be a future timestamp.') }
    }
    return { value: new Date(timestamp).toISOString(), error: null }
}

function normalizeSupportValueList(value: unknown, defaults: string[] = []) {
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : defaults
    return Array.from(new Set(raw.map(item => supportText(item).toLowerCase()).filter(Boolean)))
}

export function normalizeSupportSessionDuration(value: unknown): { value: number, error: Record<string, unknown> | null } {
    if (value === undefined || value === null || value === '') return { value: 60, error: null }
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed !== Math.trunc(parsed) || parsed < 5 || parsed > 240) {
        return { value: 0, error: supportError('invalid_duration', 'Support session duration must be between 5 and 240 minutes.') }
    }
    return { value: parsed, error: null }
}

export function normalizeSupportSessionExpiry(value: unknown, durationMinutes: number): { value: string, error: Record<string, unknown> | null } {
    if (value === undefined || value === null || value === '') {
        return { value: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(), error: null }
    }
    const timestamp = Date.parse(supportText(value))
    if (Number.isNaN(timestamp) || timestamp <= Date.now()) {
        return { value: '', error: supportError('invalid_expiry', 'Support session expiry must be a future timestamp.') }
    }
    if (timestamp > Date.now() + 240 * 60 * 1000) {
        return { value: '', error: supportError('invalid_expiry', 'Support session expiry must be within 240 minutes.') }
    }
    return { value: new Date(timestamp).toISOString(), error: null }
}
