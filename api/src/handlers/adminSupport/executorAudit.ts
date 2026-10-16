import { redactAuditValue } from '#utils/systemEvent.ts'
import type { SupportExecutorControls } from './executorCore.ts'

export type SupportExecutorAuditPreviewTargetFields =
    | { emails: string[], inviteIds: string[], expiresAt: string }
    | { inviteId: string | null, email: string | null }
    | { targetUserId: string, requestedRole: string }

export const supportExecutorCommonBlockerCatalog = [
    'support_role_required',
    'missing_support_reason',
    'stale_prepare_payload',
    'duplicate_idempotency_key',
] as const

export function supportExecutorAuditPreview(input: {
    actionType: string
    requestId: string
    organizationId: string
    reason: string
    controls: SupportExecutorControls
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
    targetFields: SupportExecutorAuditPreviewTargetFields
}) {
    return redactAuditValue({
        schemaVersion: 'support.action_execute.audit_preview.v1',
        actionType: input.actionType,
        source: 'admin',
        service: 'hanasand-api',
        requestId: input.requestId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        organizationId: input.organizationId,
        ...input.targetFields,
        reason: input.reason,
        scope: input.controls.scope,
        outcome: input.outcome,
        blockerCode: input.blockers[0] || null,
        redactionRequired: true,
    })
}

export function supportExecutorAuditQuery(input: {
    requestId: string
    organizationId: string
    entityId?: string
    targetId?: string
    correlationId: string
    idempotencyKey: string
    reason: string
    actionType: string
    outcome: string
}) {
    const params = new URLSearchParams()
    params.set('request', input.requestId)
    params.set('correlation', input.correlationId)
    params.set('idempotency', input.idempotencyKey)
    params.set('org', input.organizationId)
    if (input.entityId !== undefined) params.set('entity', input.entityId)
    if (input.targetId !== undefined) params.set('target', input.targetId)
    params.set('reason', input.reason)
    params.set('action', input.actionType)
    params.set('outcome', input.outcome)
    params.set('source', 'admin')
    params.set('service', 'hanasand-api')
    return `/api/admin/audit-events?${params.toString()}`
}
