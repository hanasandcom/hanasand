import type { FastifyReply, FastifyRequest } from 'fastify'
import { supportError, supportRequestId, supportText as text } from '#utils/support/adminSupportInput.ts'
import { loadAccessRecoveryApproval } from '../accessRecoveryApprovalStore.ts'
import { requireAdminSupport } from '../../auth.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import type { AccessRecoveryDecisionParams } from '../../accessRecoveryDecision/types.ts'
import { sendSupportAccessRecoveryInspection } from './response.ts'

export async function getSupportAccessRecoveryApproval(req: FastifyRequest<{ Params: AccessRecoveryDecisionParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const requestId = text(req.params.requestId)
    const approval = requestId ? await loadAccessRecoveryApproval(requestId) : undefined
    const inspectionRequestId = supportRequestId(req)
    if (!approval) {
        await recordSystemEvent(req, {
            actionType: 'support.organization.access_recovery.inspect',
            actorId: actor.id,
            targetType: 'access_recovery',
            targetId: requestId || 'unknown',
            entityId: requestId || null,
            requestId: inspectionRequestId,
            severity: 'notice',
            outcome: 'failed',
            context: {
                schemaVersion: 'support.access_recovery.inspect.v1',
                requestId: requestId || null,
                error: 'access_recovery_request_not_found',
                redactionRequired: true,
            },
        })
        return res.status(404).send(supportError('access_recovery_request_not_found', 'Access recovery request not found.', {
            requestId: requestId || null,
        }))
    }

    return sendSupportAccessRecoveryInspection({ req, res, actorId: actor.id, approval, inspectionRequestId })
}
