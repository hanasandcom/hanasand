import type { FastifyReply, FastifyRequest } from 'fastify'
import { authorizeRateLimitAdmin } from './authorizeAdmin.ts'
import { deleteApiKey } from '#utils/auth/apiKeys.ts'

export default async function deleteApiKeyHandler(req: FastifyRequest, res: FastifyReply) {
    if (!await authorizeRateLimitAdmin(req, res)) return

    const { id } = req.params as { id: string }
    const deleted = await deleteApiKey(id)
    if (!deleted) {
        return res.status(404).send({ error: 'API key not found.' })
    }

    return res.send({ ok: true })
}
