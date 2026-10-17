export {
    getLegacyTrafficSummary,
    getLegacyTrafficRecent,
    getLegacyTrafficTps,
    getLegacyTrafficIps,
    getLegacyTrafficUserAgents,
    getLegacyTrafficDomains,
    getLegacyTrafficMetrics,
} from './legacyAnalytics.ts'
export { getLegacyTrafficRecords } from './legacyRecords.ts'
export { getLegacyTrafficLive } from './legacyLive.ts'
export { warmTrafficStatistics } from './legacyWarm.ts'

import type { FastifyReply, FastifyRequest } from 'fastify'

export function getLegacyBlocklistOverview(_req: FastifyRequest, res: FastifyReply) {
    return res.send([])
}
