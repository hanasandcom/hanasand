import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export async function requireAiUser(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        if (!res.sent && !res.raw.headersSent) {
            res.status(401).send({ error: 'Unauthorized.' })
        }
        return null
    }

    return auth.id
}
