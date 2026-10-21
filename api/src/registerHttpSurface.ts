import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import IndexHandler from './handlers/index.ts'
import ws from './plugins/ws.ts'
import rateLimit from './plugins/rateLimit.ts'
import fp from '#utils/refresh/fp.ts'
import apiRoutes from './routes.ts'
import { ingestEvent } from './handlers/events.ts'
import { isAllowedApiOrigin } from './utils/http/publicBoundary.ts'
import { recoveryReadOnly } from './utils/recovery.ts'
import recordLog from '#utils/logs/recordLog.ts'
import recordTraffic from '#utils/traffic/recordTraffic.ts'
import { recordHttpErrorResponse } from '#utils/logs/httpErrors.ts'
import { isTransientDatabaseError } from './utils/db.ts'

export function registerHttpSurface(fastify: FastifyInstance, options: { browserWorkerOnly: boolean, httpWorkerOnly: boolean }) {
    const { browserWorkerOnly, httpWorkerOnly } = options
    fastify.register(websocketPlugin)
    fastify.register(cors, {
        origin: (origin, callback) => callback(null, isAllowedApiOrigin(origin)),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
        exposedHeaders: ['x-access-token', 'x-access-token-expires-at'],
    })

    if (!browserWorkerOnly && !httpWorkerOnly && process.env.RECOVERY_ESSENTIAL_ONLY !== '1') fastify.register(fp)
    fastify.register(ws)
    if (!browserWorkerOnly) {
        fastify.register(rateLimit)
        fastify.addHook('onSend', async (req, res, payload) => {
            if (!recoveryReadOnly() && process.env.RECOVERY_ESSENTIAL_ONLY !== '1') await recordHttpErrorResponse(req, res, payload)
            return payload
        })
        fastify.addHook('onResponse', async (req, res) => {
            await recordTraffic(req, res, !recoveryReadOnly() && process.env.RECOVERY_ESSENTIAL_ONLY !== '1')
        })
        fastify.register(apiRoutes, { prefix: '/api' })
        fastify.post('/mill', ingestEvent)
    }
    fastify.get('/', browserWorkerOnly
        ? async () => ({ ok: true, service: 'browsers' })
        : IndexHandler)

    if (!browserWorkerOnly) registerFailureLogging(fastify)
}

function registerFailureLogging(fastify: FastifyInstance) {
    fastify.addHook('onResponse', async (req, res) => {
        if (recoveryReadOnly() || process.env.RECOVERY_ESSENTIAL_ONLY === '1' || res.statusCode < 400) return
        if (res.statusCode === 401 || res.statusCode === 403) return

        const referer = req.headers.referer || req.headers.referrer || ''
        const refererText = Array.isArray(referer) ? referer.join(', ') : referer
        const isSharePageRequest = /\/(?:s|p)\//.test(refererText)
        const isVmRequest = req.url.startsWith('/api/vms')
        const category = isSharePageRequest
            ? 'share_page_http'
            : isVmRequest && /(?:connection|agent-target|sync-access)/.test(req.url)
                ? 'terminal_failure'
                : isVmRequest
                    ? 'vm_provisioning_error'
                    : null
        if (!category) return

        await recordLog({
            service: category === 'share_page_http' ? 'hanasand-frontend' : 'hanasand-api',
            level: res.statusCode >= 500 ? 'error' : 'warn',
            message: `${req.method} ${req.url} returned ${res.statusCode}`,
            metadata: { category, method: req.method, url: req.url, statusCode: res.statusCode, referer: refererText },
        }).catch(error => fastify.log.error(error, 'Failed to persist production monitor signal'))
    })
    fastify.addHook('onError', async (req, res, error) => {
        if (!res.sent && ((error as { code?: string }).code === 'DB_QUEUE_FULL' || isTransientDatabaseError(error))) {
            const preview = req.url.split('?')[0] === '/api/rules/preview'
            const message = preview
                ? 'Preview is temporarily busy. Try again shortly.'
                : 'Database is temporarily busy. Try again shortly.'
            res.header('retry-after', '1').status(503).send({ error: message })
            return
        }
        if (recoveryReadOnly() || process.env.RECOVERY_ESSENTIAL_ONLY === '1') return
        await recordLog({
            level: 'error',
            message: error.message,
            metadata: { method: req.method, url: req.url, stack: error.stack },
        }).catch(logError => fastify.log.error(logError, 'Failed to persist request error log'))
    })
}
