import config from '#constants'
import fp from 'fastify-plugin'
import getStats from './queries/stats.ts'
import getDocker from './queries/docker.ts'
import systemVms from './queries/systemVms.ts'
import { runTrackedBackgroundJob } from '../backgroundJobRuntime.ts'

export default fp(async (fastify) => {
    let refreshing = false
    async function refreshQueries() {
        if (refreshing) return
        refreshing = true
        try {
            const [stats, docker, inventory] = await Promise.all([
                getStats(),
                getDocker(),
                systemVms().catch(error => { fastify.log.warn({ error }, 'VM snapshot refresh failed'); return null })
            ])

            fastify.stats = Buffer.from(JSON.stringify(stats))
            fastify.docker = Buffer.from(JSON.stringify(docker))
            if (inventory) fastify.systemSnapshot = Buffer.from(JSON.stringify({ systemTelemetry: stats.data, dockerTelemetry: docker.data, ...inventory, generated_at: new Date().toISOString() }))
            fastify.log.debug('Cached queries refreshed')
        } catch (error) {
            fastify.log.warn({ error }, 'Cached query refresh failed')
        } finally {
            refreshing = false
        }
    }

    // Do not hold Fastify startup on VM/host telemetry or cache queries. A
    // slow host snapshot must not keep the production API out of service.
    void runTrackedBackgroundJob('api-hot-cache-refresh', refreshQueries).catch(error => {
        fastify.log.warn({ error }, 'Initial cached query refresh failed; background refresh will retry')
    })
    const timer = setInterval(() => void runTrackedBackgroundJob('api-hot-cache-refresh', refreshQueries), config.CACHE_TTL_HOT)
    fastify.addHook('onClose', async () => { clearInterval(timer) })
})
