import { loadSupportSessionState } from '#utils/support/supportSessionState.ts'

export async function validateSupportSessionForImpersonation(input: {
    actorId: string
    targetUserId: string
    organizationId: string
    supportSessionId: string
    scope: string[]
    expiresAt: string
}) {
    if (!input.supportSessionId) {
        return { error: null as { code: string, message: string, status: number } | null }
    }

    const state = await loadSupportSessionState(input.supportSessionId)
    if (!state) {
        return { error: { code: 'support_session_not_found', message: 'Support session not found.', status: 404 } }
    }
    if (state.status === 'revoked') {
        return { error: { code: 'support_session_revoked', message: 'Support session has been revoked.', status: 409 } }
    }
    if (state.status === 'expired') {
        return { error: { code: 'support_session_expired', message: 'Support session has expired.', status: 409 } }
    }
    if (state.actorId && state.actorId !== input.actorId) {
        return { error: { code: 'support_session_actor_mismatch', message: 'Support session belongs to a different support actor.', status: 403 } }
    }
    if (state.organizationId && !input.organizationId) {
        return { error: { code: 'support_session_org_required', message: 'Support session is scoped to an organization; include organizationId when starting impersonation.', status: 400 } }
    }
    if (state.organizationId && input.organizationId && state.organizationId !== input.organizationId) {
        return { error: { code: 'support_session_org_mismatch', message: 'Support session is not scoped to this organization.', status: 403 } }
    }
    if (state.targetUserId && state.targetUserId !== input.targetUserId) {
        return { error: { code: 'support_session_user_mismatch', message: 'Support session is not scoped to this target user.', status: 403 } }
    }
    if (!state.allowedActions.includes('impersonation')) {
        return { error: { code: 'support_session_action_denied', message: 'Support session does not allow impersonation.', status: 403 } }
    }
    const missingScope = input.scope.find(item => !state.scope.includes(item))
    if (missingScope) {
        return { error: { code: 'support_session_scope_denied', message: `Support session does not include impersonation scope ${missingScope}.`, status: 403 } }
    }
    const supportSessionExpiry = Date.parse(state.expiresAt)
    if (!Number.isNaN(supportSessionExpiry) && Date.parse(input.expiresAt) > supportSessionExpiry) {
        return { error: { code: 'support_session_duration_exceeds_scope', message: 'Impersonation expiry cannot exceed the scoped support session expiry.', status: 400 } }
    }
    return { error: null }
}
export function normalizeDurationMinutes(value: unknown) {
    if (value === undefined || value === null || value === '') {
        throw new Error('Impersonation duration is required.')
    }
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed !== Math.trunc(parsed)) {
        throw new Error('Impersonation duration must be a whole number of minutes.')
    }

    if (parsed < 5 || parsed > 240) {
        throw new Error('Impersonation duration must be between 5 and 240 minutes.')
    }
    return parsed
}

export function normalizeImpersonationScope(value: unknown) {
    const allowed = new Set(['read_profile', 'read_org', 'support_debug'])
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
    if (!raw.length) {
        throw new Error('Impersonation scope is required.')
    }
    const scope = raw.map(item => typeof item === 'string' ? item.trim().toLowerCase() : '')
    const unsupported = scope.find(item => !allowed.has(item))
    if (unsupported !== undefined) throw new Error(`Unsupported impersonation scope: ${unsupported || 'blank'}.`)
    return Array.from(new Set(scope))
}
