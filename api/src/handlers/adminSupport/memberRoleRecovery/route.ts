import type { FastifyReply } from 'fastify'
import { prepareMemberRoleRecovery } from './prepare.ts'
import { mutateMemberRoleRecovery } from './mutate.ts'
import { sendRoleDecisionResponse } from './roleDecisionResponse.ts'
import { sendMutationFailure } from './mutationFailureResponse.ts'
import { sendMemberRoleRecoverySuccess } from './successResponse.ts'
import type { MemberRoleRecoveryRequest } from './types.ts'

export async function postSupportOrganizationMemberRoleRecovery(req: MemberRoleRecoveryRequest, res: FastifyReply) {
    const context = await prepareMemberRoleRecovery(req, res)
    if (!context) return

    const execution = await mutateMemberRoleRecovery(context)
    if (execution.kind === 'denied') {
        return sendRoleDecisionResponse(context, res, 'denied', execution.message || 'Support role recovery is not permitted.', execution.ownerCount)
    }
    if (execution.kind === 'unchanged') {
        return sendRoleDecisionResponse(context, res, 'failed', 'member_role_already_set', execution.ownerCount)
    }

    const mutation = execution.result
    if (mutation.error !== null) return sendMutationFailure(context, res, mutation)
    return sendMemberRoleRecoverySuccess(context, res, mutation)
}
