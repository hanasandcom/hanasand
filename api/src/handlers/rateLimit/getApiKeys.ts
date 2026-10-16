import type { FastifyReply, FastifyRequest } from 'fastify'
import { authorizeRateLimitAdmin } from './authorizeAdmin.ts'
import { listApiKeys } from '#utils/auth/apiKeys.ts'

export default async function getApiKeysHandler(req: FastifyRequest, res: FastifyReply) {
    if (!await authorizeRateLimitAdmin(req, res)) return

    return res.send({
        apiKeys: await listApiKeys(),
    })
}
