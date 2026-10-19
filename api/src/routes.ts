import type { FastifyInstance } from 'fastify'
import { startLoadTestQueue } from './handlers/test/follow.ts'
import { registerCoreRoutes } from './routes/core.ts'
import { registerUserContentRoutes } from './routes/userContent.ts'
import { registerOrganizationsAndComputeRoutes } from './routes/organizationsAndCompute.ts'
import { registerPlatformOperationsRoutes } from './routes/platformOperations.ts'
import { registerAiAndObservabilityRoutes } from './routes/aiAndObservability.ts'
import tokenWrapper from './utils/auth/tokenWrapper.ts'

/**
 * Defines the routes available in the API.
 *
 * @param fastify Fastify Instance
 */
export default async function apiRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', async (req, res) => {
        const token = req.headers['x-impersonation-token']
        if (!token) return
        const auth = await tokenWrapper(req, res)
        if (!auth.valid && !res.sent) return res.status(401).send({ error: auth.error || 'Unauthorized.' })
    })
    if (process.env.API_HTTP_ONLY !== '1') startLoadTestQueue()

    await registerCoreRoutes(fastify)
    await registerUserContentRoutes(fastify)
    await registerOrganizationsAndComputeRoutes(fastify)
    await registerPlatformOperationsRoutes(fastify)
    registerAiAndObservabilityRoutes(fastify)
}
