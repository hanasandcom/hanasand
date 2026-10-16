import type { FastifyReply, FastifyRequest } from 'fastify'
import { authorizeRateLimitAdmin } from './authorizeAdmin.ts'
import { getRateLimitSettings, listRateLimitRoutes } from '#utils/rateLimit/config.ts'
import { listApiKeyTierPresets } from '#utils/auth/apiKeys.ts'

export default async function getRateLimitSettingsHandler(req: FastifyRequest, res: FastifyReply) {
    if (!await authorizeRateLimitAdmin(req, res)) return

    const settings = await getRateLimitSettings({ fresh: true })
    return res.send({
        settings,
        routes: listRateLimitRoutes(),
        tierPresets: listApiKeyTierPresets(),
    })
}
