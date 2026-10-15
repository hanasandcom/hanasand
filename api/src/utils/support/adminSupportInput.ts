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

export function normalizeOption(value: unknown, allowed: string[]) {
    const normalized = supportText(value).toLowerCase()
    return allowed.includes(normalized) ? normalized : ''
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
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : ['invite_assist', 'invite_resend', 'invite_revoke', 'member_role_recovery']
    const actions = Array.from(new Set(raw.map(item => supportText(item).toLowerCase()).filter(Boolean)))
    const unsupported = actions.filter(action => !allowed.has(action))
    if (unsupported.length) {
        return { value: [], error: supportError('invalid_scope', `Unsupported support session action: ${unsupported[0]}.`, { supportedActions: Array.from(allowed) }) }
    }
    return { value: actions, error: null }
}

export function normalizeSupportSessionScope(value: unknown): { value: string[], error: Record<string, unknown> | null } {
    const allowed = new Set(['invite:create', 'invite:resend', 'invite:revoke', 'member:role_recovery', 'recovery:invite', 'recovery:approve', 'recovery:deny', 'read_profile', 'read_org', 'support_debug'])
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : ['invite:create', 'invite:resend', 'invite:revoke', 'member:role_recovery']
    const scope = Array.from(new Set(raw.map(item => supportText(item).toLowerCase()).filter(Boolean)))
    const unsupported = scope.filter(item => !allowed.has(item))
    if (unsupported.length) {
        return { value: [], error: supportError('invalid_scope', `Unsupported support session scope: ${unsupported[0]}.`, { supportedScopes: Array.from(allowed) }) }
    }
    return { value: scope, error: null }
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
