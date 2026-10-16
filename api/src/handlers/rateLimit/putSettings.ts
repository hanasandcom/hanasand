import type { FastifyReply, FastifyRequest } from 'fastify'
import { authorizeRateLimitAdmin } from './authorizeAdmin.ts'
import { saveRateLimitSettings, validateRateLimitSettingsInput } from '#utils/rateLimit/config.ts'

export default async function putRateLimitSettingsHandler(req: FastifyRequest, res: FastifyReply) {
    const access = await authorizeRateLimitAdmin(req, res, { requireId: true })
    if (!access) return

    const validation = validateRateLimitSettingsInput(req.body, { updatedBy: access.id })
    if (!validation.valid) {
        return res.status(400).send({ error: validation.error || 'Invalid rate-limit settings.' })
    }

    const settings = await saveRateLimitSettings(req.body, access.id)
    return res.send({ settings })
}
