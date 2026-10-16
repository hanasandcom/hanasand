import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import type { SupportInviteActionContext } from './types.ts'
import { supportInviteActionAuditQuery } from './auditQuery.ts'
import { supportInviteRecoveryDenialReceipt } from './recoveryDenialReceipt.ts'

export function supportInviteActionExecutionReceipt(input: Pick<SupportInviteActionContext, 'requestId' | 'action' | 'actionType' | 'reason' | 'controls'> & {
    organizationId: string
    actorId: string
    invite: SupportInviteActionContext['invite'] | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    auditEventIds: number[]
    blockers: string[]
}) {
    const inviteId = input.invite?.id || ''
    const inviteTarget = input.invite?.email || inviteId || input.organizationId
    const denialReceipt = input.outcome === 'success'
        ? null
        : supportInviteRecoveryDenialReceipt({
            ...input,
            invite: input.invite,
            outcome: input.outcome,
        })
    return {
        schemaVersion: 'support.invite_action.execution_receipt.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        noSilentMembershipMutation: true,
        mutationMode: 'controlled_invite_row_only',
        action: input.action,
        actionType: input.actionType,
        outcome: input.outcome,
        severity: input.action === 'revoke' ? 'warning' : 'notice',
        actorId: input.actorId,
        organizationId: input.organizationId,
        targetType: 'invite',
        targetId: inviteTarget,
        entityId: inviteId || input.organizationId,
        inviteId: inviteId || null,
        requestId: input.requestId,
        reason: input.reason,
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        before: input.before,
        after: input.after,
        auditEventIds: input.auditEventIds,
        denialReceipt,
        recoveryCaseReplay: denialReceipt?.caseReplay || null,
        audit: {
            detailRoutes: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            replay: supportInviteActionAuditQuery({
                requestId: input.requestId,
                organizationId: input.organizationId,
                inviteId,
                correlationId: input.controls.correlationId,
                idempotencyKey: input.controls.idempotencyKey,
                reason: input.reason,
                actionType: input.actionType,
                outcome: input.outcome,
            }),
            byTargetType: auditFilterQuery({ targetType: 'invite', entity: inviteId, request: input.requestId }),
            deniedReplay: auditFilterQuery({ targetType: 'invite', entity: inviteId, action: input.actionType, outcome: 'denied' }),
        },
        blockers: input.blockers,
        copyText: [
            `Support invite ${input.action} receipt ${inviteId || 'unresolved invite'}`,
            `Request: ${input.requestId}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Replay: ${auditFilterQuery({ targetType: 'invite', entity: inviteId, request: input.requestId })}`,
        ].join('\n'),
    }
}
