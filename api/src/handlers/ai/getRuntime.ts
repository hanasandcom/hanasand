import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAiUser } from './shared.ts'
import { getAiRuntimeSnapshot } from './runtimeSnapshot.ts'

export default async function getAiRuntime(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) return

    const runtimeState = await getAiRuntimeSnapshot(userId)
    return res.send({ runtimeState })
}
