import type { FastifyReply } from 'fastify'
import run from '#db'
import { loadOrganizationSupportDetail } from './cases/organizationReadData.ts'
import { organizationPrivacyDeletionInProgress } from '#utils/organizationLifecycle.ts'
import { loadSupportSessionState } from '#utils/support/supportSessionState.ts'

export async function requireWritableSupportOrganization(organizationId: string, res: FastifyReply) {
    const organization = await loadOrganizationSupportDetail(organizationId)
    if (!organization) {
        res.status(404).send({ error: 'Organization not found.' })
        return null
    }
    if (organizationPrivacyDeletionInProgress(organization)) {
        res.status(409).send({ error: 'Organization deletion is in progress; support writes are blocked.' })
        return null
    }
    return organization
}

export async function validateSupportSessionForAction(input: {
    actorId: string
    supportSessionId?: string | null
    action: string
    requiredScope: string
    organizationId: string
    targetUserId?: string | null
}) {
    if (!input.supportSessionId) {
        return { state: null, error: null as { code: string, message: string, status: number } | null }
    }

    const state = await loadSupportSessionState(input.supportSessionId)
    if (!state) {
        return { state: null, error: { code: 'support_session_not_found', message: 'Support session not found.', status: 404 } }
    }
    if (state.status === 'revoked') {
        return { state, error: { code: 'support_session_revoked', message: 'Support session has been revoked.', status: 409 } }
    }
    if (state.status === 'expired') {
        return { state, error: { code: 'support_session_expired', message: 'Support session has expired.', status: 409 } }
    }
    if (state.actorId && state.actorId !== input.actorId) {
        return { state, error: { code: 'support_session_actor_mismatch', message: 'Support session belongs to a different support actor.', status: 403 } }
    }
    if (state.organizationId && state.organizationId !== input.organizationId) {
        return { state, error: { code: 'support_session_org_mismatch', message: 'Support session is not scoped to this organization.', status: 403 } }
    }
    if (state.targetUserId && input.targetUserId && state.targetUserId !== input.targetUserId) {
        return { state, error: { code: 'support_session_user_mismatch', message: 'Support session is not scoped to this target user.', status: 403 } }
    }
    if (!state.allowedActions.includes(input.action)) {
        return { state, error: { code: 'support_session_action_denied', message: 'Support session does not allow this support action.', status: 403 } }
    }
    if (!state.scope.includes(input.requiredScope)) {
        return { state, error: { code: 'support_session_scope_denied', message: 'Support session does not include the required action scope.', status: 403 } }
    }
    return { state, error: null }
}

export async function loadSupportSuccessfulIdempotencyReceipt(input: {
    eventType: string
    organizationId: string
    subjectId?: string
    idempotencyKey: string
}) {
    const result = await run(`
        SELECT id, request_id, subject_id, context
        FROM system_events
        WHERE event_type = $1
          AND organization_id = $2
          AND ($3::text IS NULL OR subject_id = $3)
          AND outcome = 'success'
          AND context->>'idempotencyKey' = $4
        ORDER BY created_at ASC, id ASC
        LIMIT 1
    `, [input.eventType, input.organizationId, input.subjectId ?? null, input.idempotencyKey])
    return result.rows[0] as { id: number, request_id: string, subject_id: string | null, context: Record<string, unknown> } | undefined
}
