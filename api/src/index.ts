import { processLiveLogs, processStoredLogs } from '#utils/events/processLogs.ts'
import { processRuleReprocessJob } from '#utils/events/ruleReprocess.ts'
import { LIVE_LOG_PROCESSOR_JOB_ID, RULE_REPROCESSOR_JOB_ID, startLogProcessor, STORED_LOG_PROCESSOR_JOB_ID } from '#utils/events/processor.ts'
import { startBackgroundAnalytics } from './utils/backgroundAnalytics.ts'
import { recoveryRequestAllowed } from './utils/recovery.ts'
import { queryOnce, closeDatabase, withEventDatabase, warmDatabasePools } from './utils/db.ts'
import Fastify from 'fastify'
import cron from './utils/cron.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import ensureSchema from '#utils/db/ensureSchema.ts'
import ensureLogSearchIndexes from './utils/db/logSearchIndexes.ts'
import { loadCachedLogMetrics, startLogMetricsRefresh } from './handlers/logs/metrics.ts'
import { loadCachedMostActiveServices, startMostActiveServicesRefresh } from './handlers/logs/mostActive.ts'
import { startLogTuningSnapshotRefresh } from './handlers/logs/tuning.ts'
import { startIngestAccessCounterRefresh } from './utils/events/analyzeIngestAccess.ts'
import { startDropRateAlertRefresh } from './utils/events/dropRateAlert.ts'
import { startDatabaseOverviewRefresh, warmDatabaseOverview } from './utils/db/overview.ts'
import recordLog from '#utils/logs/recordLog.ts'
import { provisionExistingMailAccounts } from '#utils/mail/accounts.ts'
import { TRUSTED_API_PROXIES } from '#utils/http/publicBoundary.ts'
import { randomUUID } from 'node:crypto'
import { registerHttpSurface } from './registerHttpSurface.ts'

process.on('uncaughtException', error => {
    if (isBunWebSocketErrorEvent(error)) {
        void recordLog({
            level: 'warn',
            service: 'hanasand-api',
            message: 'Suppressed Bun WebSocket ErrorEvent so the API process stays alive.',
            metadata: { category: 'websocket_error_event', error: describeUnknownError(error) },
        }).catch(() => undefined)
        return
    }
    throw error
})

const fastify = Fastify({
    logger: true,
    disableRequestLogging: process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1',
    trustProxy: TRUSTED_API_PROXIES,
    genReqId: () => randomUUID(),
})
const port = Number(process.env.PORT) || 8081
const httpWorkerOnly = process.env.API_HTTP_ONLY === '1'
const deploymentCandidateOnly = process.env.DEPLOYMENT_CANDIDATE_ONLY === '1'
fastify.addHook('onRequest', async (req, reply) => {
    if (!recoveryRequestAllowed(req.method, req.url.split('?')[0])) {
        return reply.code(503).header('Retry-After', '30').send({ code: 'recovery_read_only', error: 'Recovery mode: viewing existing cases, alerts and intelligence is available. Changes and new processing are temporarily paused.' })
    }
})
fastify.get('/health', async (_req, reply) => {
    try {
        await queryOnce('SELECT 1')
        return { ok: true, service: 'api', release: process.env.HANASAND_RELEASE_COMMIT || 'unknown' }
    } catch { return reply.code(503).send({ ok: false }) }
})
if (httpWorkerOnly) {
    process.once('SIGTERM', () => { void fastify.close().then(closeDatabase) })
}

const browserWorkerOnly = process.env.BROWSER_SANDBOX_WORKER_ONLY === '1'

fastify.decorate('cachedIPMetrics', { status: 200, data: Buffer.from(JSON.stringify([])) })
fastify.removeContentTypeParser('application/json')
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = Buffer.isBuffer(body) ? body.toString('utf8') : body
    if (!text.trim()) {
        done(null, {})
        return
    }

    try {
        done(null, JSON.parse(text))
    } catch (error) {
        done(error as Error, undefined)
    }
})
fastify.addContentTypeParser('application/octet-stream', { parseAs: 'string' }, (_req, body, done) => done(null, Buffer.isBuffer(body) ? body.toString('utf8') : body))

registerHttpSurface(fastify, { browserWorkerOnly, httpWorkerOnly })

process.on('unhandledRejection', reason => {
    void recordLog({
        level: 'fatal',
        message: reason instanceof Error ? reason.message : String(reason),
        metadata: { reason: reason instanceof Error ? { name: reason.name, message: reason.message, stack: reason.stack, code: (reason as Error & { code?: string }).code } : reason },
    }).catch(error => fastify.log.error(error, 'Failed to persist unhandled rejection log'))
})

async function start() {
    try {
        // A cutover candidate must prepare the release schema before it can
        // serve traffic, while API_HTTP_ONLY keeps it from running duplicate
        // production workers beside the active API.
        if (!browserWorkerOnly && (!httpWorkerOnly || deploymentCandidateOnly)) await ensureSchema()
        if (!browserWorkerOnly && !httpWorkerOnly) await ensureLogSearchIndexes()
        if (!browserWorkerOnly && !httpWorkerOnly && process.env.SKIP_MAIL_PROVISIONING !== '1') {
            await provisionExistingMailAccounts().catch(error => {
                if (isMailAdminConfigError(error)) {
                    fastify.log.debug('Mail account startup provisioning skipped because mail administration is not configured')
                    return
                }

                fastify.log.warn({ error }, 'Failed to provision mail accounts on startup')
            })
        }
        if (!browserWorkerOnly && !httpWorkerOnly) await warmDatabasePools()
        if (!browserWorkerOnly && process.env.AUTH_SERVICE_ONLY !== '1') {
            void warmDatabaseOverview().then(overview => {
                if (overview?.status === 'unavailable') fastify.log.warn({ message: overview.health.message }, 'Database overview cache started without live metrics')
            }).catch(error => {
                fastify.log.warn({ error }, 'Failed to warm cached database overview')
            })
            const stopDatabaseOverviewRefresh = startDatabaseOverviewRefresh(error => fastify.log.warn({ error }, 'Failed to refresh cached database overview'))
            fastify.addHook('onClose', async () => { stopDatabaseOverviewRefresh() })
        }
        if (!browserWorkerOnly && process.env.AUTH_SERVICE_ONLY !== '1') {
            const stopIngestAccessCounterRefresh = startIngestAccessCounterRefresh(fastify.log)
            fastify.addHook('onClose', async () => { await stopIngestAccessCounterRefresh() })
            const stopDropRateAlertRefresh = startDropRateAlertRefresh(fastify.log)
            fastify.addHook('onClose', async () => { stopDropRateAlertRefresh() })
        }
        if (!browserWorkerOnly && !httpWorkerOnly && process.env.AUTH_SERVICE_ONLY !== '1') {
            void loadCachedLogMetrics().catch(error => fastify.log.warn({ error }, 'Failed to warm log throughput metrics cache; background refresh will retry'))
            const stopMetricsRefresh = startLogMetricsRefresh()
            fastify.addHook('onClose', async () => { stopMetricsRefresh() })
        }
        if (!browserWorkerOnly && process.env.AUTH_SERVICE_ONLY !== '1') {
            void loadCachedMostActiveServices().catch(error => fastify.log.warn({ error }, 'Failed to warm most active services cache; background refresh will retry'))
            const stopMostActiveRefresh = startMostActiveServicesRefresh()
            fastify.addHook('onClose', async () => { stopMostActiveRefresh() })
        }
        if (!browserWorkerOnly && !httpWorkerOnly && process.env.AUTH_SERVICE_ONLY !== '1') {
            const stopProcessing = process.env.LOG_CATCHUP_WORKER_DISABLED === '1'
                ? async () => {}
                : startLogProcessor(() => withEventDatabase(processStoredLogs), error => fastify.log.error({ error }, 'Event log processing failed; will retry'), undefined, undefined, undefined, STORED_LOG_PROCESSOR_JOB_ID)
            const stopLiveProcessing = process.env.LOG_LIVE_WORKER_DISABLED === '1'
                ? async () => {}
                : startLogProcessor(() => withEventDatabase(processLiveLogs), error => fastify.log.error({ error }, 'Event live processing failed; will retry'), () => 100, undefined, 100, LIVE_LOG_PROCESSOR_JOB_ID)
            const stopReprocessing = startLogProcessor(processRuleReprocessJob, error => fastify.log.error({ error }, 'Rule reprocessing failed'), () => 1000, undefined, undefined, RULE_REPROCESSOR_JOB_ID)
            fastify.addHook('onClose', async () => { await Promise.all([stopProcessing(), stopLiveProcessing(), stopReprocessing()]) })
        }
        if (!browserWorkerOnly && !httpWorkerOnly) {
            const stopAnalytics = await startBackgroundAnalytics(fastify.log)
            fastify.addHook('onClose', async () => { stopAnalytics() })
        }
        if (!browserWorkerOnly && !httpWorkerOnly && process.env.AUTH_SERVICE_ONLY !== '1') {
            const stopLogTuningRefresh = startLogTuningSnapshotRefresh(fastify.log)
            fastify.addHook('onClose', async () => { stopLogTuningRefresh() })
        }
        await fastify.listen({ port, host: process.env.LISTEN_HOST || '0.0.0.0' })
        if (browserWorkerOnly || httpWorkerOnly) return
        if (process.env.SKIP_REPOSITORY_SYNC !== '1') {
            void ensureRepositoryUpToDate().catch(error => {
                fastify.log.warn({ error }, 'Failed to warm articles repository')
            })
        }
    } catch (error) {
        fastify.log.error(error)
        process.exit(1)
    }
}

function isMailAdminConfigError(error: unknown) {
    return error instanceof Error && error.message.includes('MAIL_ADMIN_PASSWORD is required')
}

function isBunWebSocketErrorEvent(error: unknown) {
    if (!error || typeof error !== 'object') return false
    const event = error as { constructor?: { name?: string }, isTrusted?: unknown, type?: unknown }
    return event.constructor?.name === 'ErrorEvent'
        || event.isTrusted !== undefined
        || String(error).includes('ErrorEvent')
}

function describeUnknownError(error: unknown) {
    if (error instanceof Error) return error.message
    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

function main() {
    start()
    if (!browserWorkerOnly && !httpWorkerOnly) cron()
}

main()
