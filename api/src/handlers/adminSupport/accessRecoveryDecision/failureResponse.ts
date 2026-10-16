import type { FastifyReply } from 'fastify'
import { toAccessRecoveryDecision } from '../cases/accessRecoveryApprovalMapping.ts'
import { supportAccessRecoveryDecisionReceipt } from '../cases/accessRecoveryDecisionReceipt.ts'
import { supportError } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds } from '#utils/systemEvent.ts'
import { recordAccessRecoveryDecisionAudit } from './audit.ts'
import type { AccessRecoveryDecision, DecisionFailureCurrent, DecisionReceiptContext } from './types.ts'

export async function sendAccessRecoveryDecisionFailure(input: {
    req: Parameters<typeof recordAccessRecoveryDecisionAudit>[0]
    res: FastifyReply
    actorId: string
    current: DecisionFailureCurrent
    decision: AccessRecoveryDecision
    reason: string
    outcome: 'denied' | 'failed'
    blocker: string
    message: string
    status: number
    receiptContext: DecisionReceiptContext
    auditExtra?: Record<string, unknown>
    responseExtra?: Record<string, unknown>
    useSupportError?: boolean
}) {
    await recordAccessRecoveryDecisionAudit(
        input.req,
        input.actorId,
        input.current,
        input.decision,
        input.outcome,
        input.reason,
        input.auditExtra,
    )
    const auditEventIds = await loadSystemEventIds({
        requestId: input.current.request_id,
        actionType: `support.organization.access_recovery.${input.decision === 'approved' ? 'approve' : 'deny'}`,
        entityId: input.current.invite_id,
    })
    const detail = toAccessRecoveryDecision(input.current)
    const response = {
        ...(input.responseExtra || {}),
        decision: detail,
        decisionReceipt: supportAccessRecoveryDecisionReceipt({
            ...input.receiptContext,
            approval: detail,
            outcome: input.outcome,
            auditEventIds,
            blockers: [input.blocker],
        }),
    }
    if (input.useSupportError) {
        return input.res.status(input.status).send(supportError(input.blocker, input.message, {
            requestId: input.current.request_id,
            auditEventIds,
            ...response,
        }))
    }
    return input.res.status(input.status).send({ error: input.message, ...response })
}
