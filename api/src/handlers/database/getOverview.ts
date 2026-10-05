import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { getCachedDatabaseOverview } from '#utils/db/overview.ts'

export default async function getDatabaseOverview(req: FastifyRequest<{ Querystring: { summary?: string } }>, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })

    const role = await hasHanasandInternalRouteAccess(req)
    if (!role.valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })

    const overview = await getCachedDatabaseOverview()
    if (req.query.summary === '1') {
        return res.send({
            ...overview,
            queries: [],
            longestQuery: null,
            querySummary: {
                count: overview.queries.length,
                longRunningCount: overview.queries.filter(query => query.isLongRunning).length,
                longestDurationSeconds: overview.longestQuery?.durationSeconds ?? null,
            },
        })
    }

    return res.send(overview)
}
