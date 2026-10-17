import { uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { redactAuditValue } from '#utils/systemEvent.ts'
import type { SupportActionPreparationInput } from './inspectionActionPreparation.ts'
import { supportActionExecutionTarget, supportActionExecutorRequiredBody } from './actionExecutionTarget.ts'

export function supportActionExecutionHandoff(input: {
    action: SupportActionPreparationInput['action']
    allowed: boolean
    organizationId: string | null
    user: string
    email: string
    requestId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    durationMinutes: number | null
    expiresAt: string | null
    handoffExpiresAt: string
    noAdminAvailable: boolean
    blockers: string[]
}) {
    const execution = supportActionExecutionTarget(input)
    const executorReadiness = supportActionExecutorReadiness({
        ...input,
        execution,
    })
    return {
        schemaVersion: 'support.action_execution_handoff.v1',
        immutable: true,
        dryRun: true,
        executable: executorReadiness.ready,
        action: input.action,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        requestId: input.requestId,
        expiresAt: input.handoffExpiresAt,
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_request',
        blockers: executorReadiness.blockers,
        preparationBlockers: input.blockers,
        execution,
        executorReadiness,
        audit: {
            actionType: execution.auditActionType,
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            supportSessionId: input.supportSessionId || null,
            outcome: executorReadiness.ready ? 'success' : 'denied',
            blockerCode: executorReadiness.blockers[0] || null,
        },
    }
}

export function supportActionExecutorReadiness(input: {
    action: SupportActionPreparationInput['action']
    allowed: boolean
    organizationId: string | null
    user: string
    email: string
    requestId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    durationMinutes: number | null
    expiresAt: string | null
    handoffExpiresAt: string
    noAdminAvailable: boolean
    blockers: string[]
    execution: ReturnType<typeof supportActionExecutionTarget>
}) {
    const selectedSafeAction: SupportActionPreparationInput['action'] = 'invite_assist'
    const executorBlockers = uniqueTimelineValues([
        ...input.blockers,
        input.action === selectedSafeAction ? '' : 'mutation_unavailable',
        input.action === selectedSafeAction && (!input.organizationId || !input.email) ? 'invite_unavailable' : '',
        input.action !== 'impersonation' && !input.noAdminAvailable ? 'active_admin_available' : '',
    ])
    const ready = input.allowed && input.action === selectedSafeAction && executorBlockers.length === 0
    return {
        schemaVersion: 'support.action_executor_readiness.v1',
        mutationMode: 'no_mutation_readiness',
        noMutation: true,
        immutableHandoffRequired: true,
        selectedAction: selectedSafeAction,
        action: input.action,
        ready,
        executableByExistingEndpoint: ready,
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        durationRequired: input.action === 'impersonation',
        expiryRelevant: input.action !== 'impersonation',
        requestId: input.requestId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        supportSessionId: input.supportSessionId || null,
        target: {
            organizationId: input.organizationId,
            userId: input.user || null,
            email: input.email || null,
        },
        freshness: {
            expiresAt: input.handoffExpiresAt,
            staleBlocker: 'stale_prepare_payload',
            staleHandoffBlocker: 'stale_handoff',
            validation: 'executor_must_reject_after_handoff_expires',
        },
        idempotency: {
            key: input.idempotencyKey,
            requiredHeader: 'x-idempotency-key',
            duplicateBlocker: 'duplicate_request',
            duplicateIdempotencyKeyBlocker: 'duplicate_idempotency_key',
            validation: 'executor_must_reject_reused_key_for_target_and_action',
        },
        executorContract: {
            method: input.execution.method,
            path: input.execution.path,
            requiredHeaders: input.supportSessionId
                ? ['authorization', 'x-request-id', 'x-idempotency-key', 'x-support-session-id']
                : ['authorization', 'x-request-id', 'x-idempotency-key'],
            requiredBody: supportActionExecutorRequiredBody(input.action),
            bodyPreview: input.execution.body,
            auditActionType: input.execution.auditActionType,
        },
        blockers: executorBlockers,
        blockerCatalog: [
            'support_role_required',
            'missing_support_reason',
            'missing_scope',
            'invalid_scope',
            'invalid_duration',
            'invalid_expiry',
            'stale_handoff',
            'stale_prepare_payload',
            'duplicate_request',
            'duplicate_idempotency_key',
            'ambiguous_target',
            'active_admin_available',
            'mutation_unavailable',
            'invite_unavailable',
            'impersonation_ineligible',
            'audit_unavailable',
            'redaction_required',
        ],
        redactedAuditPreview: redactAuditValue({
            schemaVersion: 'support.action_executor_readiness.audit_preview.v1',
            actionType: input.execution.auditActionType,
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            supportSessionId: input.supportSessionId || null,
            outcome: ready ? 'success' : 'denied',
            blockerCode: executorBlockers[0] || null,
            targetOrganizationId: input.organizationId,
            targetUserId: input.user || null,
            targetEmail: input.email || null,
            reason: input.reason,
            context: input.context,
            scope: input.scope,
            durationMinutes: input.durationMinutes,
            expiresAt: input.expiresAt,
            execution: input.execution,
            redactionRequired: true,
        }),
    }
}
