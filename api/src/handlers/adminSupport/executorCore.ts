import type { FastifyRequest } from 'fastify'
import { supportActionIdempotencyKey } from './cases/inspection/inspectionActionPreparation.ts'
import { headerText, normalizeSupportPreparationScope, supportSessionIdFromRequest, supportText as text } from '#utils/support/adminSupportInput.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'

export type SupportExecutorControlsBody = {
    idempotencyKey?: unknown
    idempotency_key?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    scope?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
}

export type SupportExecutorControls = {
    schemaVersion: string
    requestId: string
    correlationId: string
    idempotencyKey: string
    supportSessionId: string
    scope: string[]
    handoffExpiresAt: string | null
    staleBlocker: string
    duplicateBlocker: string
}

export type SupportExecutorControlsResult = {
    value: SupportExecutorControls
    error: { code: string, message: string, status: number } | null
}

export function supportExecutorMetadata(requestId: string, controls: SupportExecutorControls, expiryRequired?: boolean) {
    return {
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        ...(expiryRequired !== undefined ? { expiryRequired } : {}),
        noSilentMembershipMutation: true,
        requestId,
        correlationId: controls.correlationId,
        idempotencyKey: controls.idempotencyKey,
        supportSessionId: controls.supportSessionId || null,
        staleBlocker: controls.staleBlocker,
        duplicateBlocker: controls.duplicateBlocker,
    }
}

export function supportExecutorControls(input: {
    req: FastifyRequest
    body: SupportExecutorControlsBody | undefined
    requestId: string
    idempotencyAction: string
    scopeAction: string
    requiredScope: string
    invalidScopeMessage: string
    invalidExpiryMessage: string
    expiredHandoffMessage: string
}): SupportExecutorControlsResult {
    const { req, body, requestId } = input
    const idempotencyKey = supportActionIdempotencyKey(
        headerText(req.headers['x-idempotency-key']) || body?.idempotencyKey || body?.idempotency_key || requestId,
        input.idempotencyAction,
    )
    const correlationId = text(headerText(req.headers['x-correlation-id']) || body?.correlationId || body?.correlation_id || requestId) || requestId
    const supportSessionId = supportSessionIdFromRequest(req, body)
    const scopeResult = normalizeSupportPreparationScope(body?.scope || input.requiredScope, input.scopeAction)
    const base: SupportExecutorControls = {
        schemaVersion: 'support.action_execute.controls.v1',
        requestId,
        correlationId,
        idempotencyKey,
        supportSessionId,
        scope: scopeResult.value,
        handoffExpiresAt: null,
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_idempotency_key',
    }
    if (scopeResult.error || !scopeResult.value.includes(input.requiredScope)) {
        return { value: base, error: { code: 'invalid_scope', message: input.invalidScopeMessage, status: 400 } }
    }

    const handoffExpiresAt = text(headerText(req.headers['x-support-handoff-expires-at']) || body?.handoffExpiresAt || body?.handoff_expires_at)
    if (!handoffExpiresAt) {
        return { value: base, error: null }
    }
    const timestamp = Date.parse(handoffExpiresAt)
    if (Number.isNaN(timestamp)) {
        return { value: base, error: { code: 'invalid_expiry', message: input.invalidExpiryMessage, status: 400 } }
    }
    const value = { ...base, handoffExpiresAt: new Date(timestamp).toISOString() }
    if (timestamp <= Date.now()) {
        return { value, error: { code: 'stale_prepare_payload', message: input.expiredHandoffMessage, status: 409 } }
    }
    return { value, error: null }
}

export async function recordSupportExecutorBlock(req: FastifyRequest, input: {
    actionType: string
    action: string
    actorId: string
    targetType: string
    targetId: string
    entityId: string
    organizationId: string
    requestId: string
    reason: string
    severity: 'notice' | 'warning'
    blocker: string
    controls: SupportExecutorControls
    supportContext: string
    actionContext: Record<string, unknown>
}) {
    await recordSystemEvent(req, {
        actionType: input.actionType,
        actorId: input.actorId,
        targetType: input.targetType,
        targetId: input.targetId,
        organizationId: input.organizationId,
        entityId: input.entityId,
        requestId: input.requestId,
        severity: input.severity,
        outcome: 'denied',
        reason: input.reason,
        context: {
            schemaVersion: 'support.action_executor_blocker.v1',
            action: input.action,
            blocker: input.blocker,
            blockerCode: input.blocker,
            requestId: input.requestId,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            targetOrganizationId: input.organizationId,
            ...input.actionContext,
            scope: input.controls.scope,
            handoffExpiresAt: input.controls.handoffExpiresAt,
            noSilentMembershipMutation: true,
            mutation: 'none',
            redactionRequired: true,
            supportContext: input.supportContext,
        },
    })
}
