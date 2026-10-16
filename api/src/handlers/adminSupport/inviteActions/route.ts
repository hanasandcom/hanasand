import type { FastifyReply } from 'fastify'
import { executeSupportInviteAction } from './execute.ts'
import { prepareSupportInviteAction } from './prepare.ts'
import type { SupportInviteActionRequest } from './types.ts'

export async function postSupportOrganizationInviteAction(req: SupportInviteActionRequest, res: FastifyReply) {
    const context = await prepareSupportInviteAction(req, res)
    if (!context) return
    return executeSupportInviteAction(context, res)
}
