import { uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { redactAuditValue } from '#utils/systemEvent.ts'
import { auditTimelineLink } from '../../audit/auditLinks.ts'
import type { SupportActionPreparationInput } from './inspectionActionPreparation.ts'
import { supportActionExecutionHandoff } from './actionExecutionHandoff.ts'

export function buildSupportActionPreparation(input: {
    input: SupportActionPreparationInput
    organizationIds: string[]
    user: string
    email: string
    request: string
    inviteAssistBlockers: string[]
    accessRecoveryBlockers: string[]
    impersonationBlockers: string[]
    noAdminAvailable: boolean
    timeline: Array<Record<string, any>>
}) {
    const actionBlockers = input.input.action === 'invite_assist'
        ? input.inviteAssistBlockers
        : input.input.action === 'access_recovery'
            ? input.accessRecoveryBlockers
            : input.impersonationBlockers
    const blockers = uniqueTimelineValues([
        ...actionBlockers,
        input.input.scope.length ? '' : 'missing_scope',
        input.input.action === 'impersonation' && !input.input.durationMinutes ? 'invalid_duration' : '',
    ])
    const allowed = blockers.length === 0
    const actionType = input.input.action === 'impersonation'
        ? 'impersonation.start'
        : input.input.action === 'access_recovery'
            ? 'support.organization.access_recovery'
            : 'support.organization.invite_assist'
    const organizationId = input.organizationIds[0] || null
    const targetId = input.user || input.email || organizationId || null
    const requestId = input.request || 'generated-on-submit'
    const correlationId = requestId === 'generated-on-submit' ? input.input.idempotencyKey : requestId
    const handoffExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const executionHandoff = supportActionExecutionHandoff({
        action: input.input.action,
        allowed,
        organizationId,
        user: input.user,
        email: input.email,
        requestId,
        correlationId,
        idempotencyKey: input.input.idempotencyKey,
        reason: input.input.reason,
        context: input.input.context,
        scope: input.input.scope,
        supportSessionId: input.input.supportSessionId,
        durationMinutes: input.input.durationMinutes,
        expiresAt: input.input.expiresAt,
        handoffExpiresAt,
        noAdminAvailable: input.noAdminAvailable,
        blockers,
    })
    const executorReadiness = executionHandoff.executorReadiness

    return {
        schemaVersion: 'support.action_prepare.v1',
        requested: true,
        dryRun: true,
        action: input.input.action,
        allowed,
        outcome: allowed ? 'success' : 'denied',
        requestId,
        correlationId,
        idempotencyKey: input.input.idempotencyKey,
        handoffExpiresAt,
        target: {
            organizationId,
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
        },
        reason: input.input.reason,
        context: input.input.context,
        scope: input.input.scope,
        durationMinutes: input.input.durationMinutes,
        expiresAt: input.input.expiresAt,
        blockers,
        executionHandoff,
        executorReadiness,
        auditPreview: {
            actionType,
            source: 'admin',
            service: 'hanasand-api',
            severity: input.input.action === 'impersonation' || input.input.action === 'access_recovery' ? 'warning' : 'notice',
            outcome: allowed ? 'success' : 'denied',
            targetType: input.input.action === 'impersonation' ? 'user' : input.input.action === 'access_recovery' ? 'invite' : 'organization',
            targetId,
            organizationId,
            entityId: targetId,
            requestId,
            reason: input.input.reason,
            context: redactAuditValue({
                schemaVersion: 'support.action_prepare.audit_preview.v1',
                action: input.input.action,
                dryRun: true,
                correlationId,
                idempotencyKey: input.input.idempotencyKey,
                supportSessionId: input.input.supportSessionId || null,
                handoffExpiresAt,
                execution: executionHandoff.execution,
                targetUserId: input.user || null,
                email: input.email || null,
                organizationIds: input.organizationIds,
                scope: input.input.scope,
                durationMinutes: input.input.durationMinutes,
                expiresAt: input.input.expiresAt,
                blockers,
                blockerCode: blockers[0] || null,
                timelineEventIds: input.timeline.map(event => event.id),
            }),
        },
        audit: auditTimelineLink({
            org: organizationId,
            target: input.user || input.email,
            request: input.request,
            action: input.input.action === 'impersonation' ? 'impersonation' : input.input.action,
            outcome: allowed ? 'success' : 'denied',
        }),
        copyText: [
            `Support action prepare ${input.input.action}`,
            `Target org=${organizationId || '*'} user=${input.user || '*'} email=${input.email || '*'}`,
            `Outcome: ${allowed ? 'allowed' : `blocked:${blockers.join(',')}`}`,
            `Request: ${requestId}`,
            `Reason: ${input.input.reason}`,
        ].join('\n'),
    }
}
