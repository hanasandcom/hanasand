import { redactAuditValue } from '#utils/systemEvent.ts'
import type { SupportActionPreparationInput } from './inspectionActionPreparation.ts'

export function supportActionExecutorRequiredBody(action: SupportActionPreparationInput['action']) {
    if (action === 'impersonation') {
        return ['object_id', 'organization_id', 'reason', 'scope', 'duration_minutes', 'context']
    }
    if (action === 'access_recovery') {
        return ['email', 'targetUserId', 'reason', 'context', 'scope', 'expiresAt']
    }
    return ['email', 'reason', 'context', 'scope', 'expiresAt']
}

export function supportActionExecutionTarget(input: {
    action: SupportActionPreparationInput['action']
    organizationId: string | null
    user: string
    email: string
    requestId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId?: string
    durationMinutes: number | null
    expiresAt: string | null
}) {
    const headers = {
        'x-request-id': input.requestId,
        'x-idempotency-key': input.idempotencyKey,
        ...(input.supportSessionId ? { 'x-support-session-id': input.supportSessionId } : {}),
    }
    if (input.action === 'impersonation') {
        return {
            method: 'POST',
            path: '/api/impersonation/start',
            headers,
            auditActionType: 'impersonation.start',
            body: redactAuditValue({
                object_id: input.user,
                organization_id: input.organizationId,
                reason: input.reason,
                scope: input.scope,
                duration_minutes: input.durationMinutes,
                context: input.context,
            }),
        }
    }

    const organizationPath = input.organizationId ? encodeURIComponent(input.organizationId) : ':organizationId'
    if (input.action === 'access_recovery') {
        return {
            method: 'POST',
            path: `/api/admin/support/organizations/${organizationPath}/access-recovery`,
            headers,
            auditActionType: 'support.organization.access_recovery',
            body: redactAuditValue({
                email: input.email,
                targetUserId: input.user || null,
                reason: input.reason,
                context: input.context,
                scope: input.scope,
                expiresAt: input.expiresAt,
            }),
        }
    }

    return {
        method: 'POST',
        path: `/api/admin/support/organizations/${organizationPath}/invites`,
        headers,
        auditActionType: 'support.organization.invite_assist',
        body: redactAuditValue({
            email: input.email,
            reason: input.reason,
            context: input.context,
            scope: input.scope,
            expiresAt: input.expiresAt,
        }),
    }
}
