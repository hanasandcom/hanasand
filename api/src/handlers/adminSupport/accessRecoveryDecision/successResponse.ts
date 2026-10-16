import type { FastifyReply } from 'fastify'
import { toAccessRecoveryDecision } from '../cases/accessRecoveryApprovalMapping.ts'
import { supportAccessRecoveryDecisionReceipt } from '../cases/accessRecoveryDecisionReceipt.ts'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'
import { loadSystemEventIds } from '#utils/systemEvent.ts'
import { recordAccessRecoveryDecisionAudit } from './audit.ts'
import type { AccessRecoveryDecision, DecisionReceiptContext } from './types.ts'
import { cleanContext } from '#utils/support/adminSupportInput.ts'

export async function sendAccessRecoveryDecisionSuccess(input: {
    req: Parameters<typeof recordAccessRecoveryDecisionAudit>[0]
    res: FastifyReply
    actorId: string
    current: AccessRecoveryApprovalRow
    updatedApproval: AccessRecoveryApprovalRow
    invite: { status?: string }
    decision: AccessRecoveryDecision
    reason: string
    receiptContext: DecisionReceiptContext
}) {
    const updated = {
        ...input.current,
        ...input.updatedApproval,
        email: input.current.email,
        role: input.current.role,
        organization_name: input.current.organization_name,
        invite_status: input.invite.status || input.current.invite_status,
    } as AccessRecoveryApprovalRow
    const detail = toAccessRecoveryDecision(updated)
    await recordAccessRecoveryDecisionAudit(
        input.req,
        input.actorId,
        updated,
        input.decision,
        input.decision === 'approved' ? 'success' : 'denied',
        input.reason,
        {
            decision: detail,
            supportSessionId: input.receiptContext.supportSessionId || null,
            supportContext: cleanContext(input.req.body?.context),
        },
    )
    const auditEventIds = await loadSystemEventIds({
        requestId: updated.request_id,
        actionType: `support.organization.access_recovery.${input.decision === 'approved' ? 'approve' : 'deny'}`,
        entityId: updated.invite_id,
    })
    return input.res.send({
        decision: detail,
        decisionReceipt: supportAccessRecoveryDecisionReceipt({
            ...input.receiptContext,
            approval: detail,
            outcome: input.decision === 'approved' ? 'success' : 'denied',
            auditEventIds,
            blockers: input.decision === 'denied' ? ['denied_recovery_approval'] : [],
        }),
    })
}
