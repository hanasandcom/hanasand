import type { FastifyReply } from 'fastify'
import { createAccessRecoveryInvite } from './createInvite.ts'
import { prepareSupportAccessRecoveryRequest } from './prepare.ts'
import { sendAccessRecoverySuccess } from './successResponse.ts'
import type { SupportAccessRecoveryRequest } from './types.ts'

export async function postSupportAccessRecovery(req: SupportAccessRecoveryRequest, res: FastifyReply) {
    const context = await prepareSupportAccessRecoveryRequest(req, res)
    if (!context) return
    const prepared = await createAccessRecoveryInvite(context, res)
    if (!prepared) return
    return sendAccessRecoverySuccess(prepared, res)
}
