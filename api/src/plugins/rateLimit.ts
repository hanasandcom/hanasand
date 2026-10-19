import { hasLogIngestToken } from '#utils/auth/logIngestToken.ts'
import { recoveryReadOnly } from '#utils/recovery.ts'
import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import { matchApiKeyScope } from '#utils/auth/apiKeys.ts'
import { validateSession } from '#utils/auth/session.ts'
import {
    consumeSharedRateLimitPair,
    getRateLimitSettings,
    registerRateLimitRoute,
    resetSharedRateLimitBuckets,
} from '#utils/rateLimit/config.ts'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { isTransientDatabaseError } from '#db'
import { normalizeRequestPath, resolveRateLimitActor, type RateLimitActor } from './rateLimitActor.ts'
import { isBrowserStreamPath, isInfrastructureWebSocketPath, isTrustedStatusIngest, internalTokenRoutes, resolveRouteRule } from './rateLimitPolicy.ts'
import { applyCredentialLimitHeaders, consumeCredentialPeriodBudgets, credentialPeriodLimits } from './credentialRateLimits.ts'
import { applyRateLimitHeaders, sendBoundaryError, sendRateLimitExceeded } from './rateLimitResponses.ts'

export { credentialPeriodLimits, resolveRateLimitActor }

// ponytail: per-worker counters during read-only recovery; shared DB limits resume with writes.
const recoveryBuckets = new Map<string, { count: number; resetAt: number }>()

export async function resetApiKeyRateLimitBuckets(apiKeyId: string) {
    return resetSharedRateLimitBuckets(`api_key:${apiKeyId}:`)
}

export default fp(async function rateLimitPlugin(fastify: FastifyInstance) {
    fastify.addHook('onRoute', (routeOptions: RouteOptions) => {
        const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method]
        for (const method of methods) {
            registerRateLimitRoute({
                method: String(method),
                route: routeOptions.url,
            })
        }
    })

    fastify.addHook('preHandler', (req, res, done) => {
        // Retry only the authentication/rate-limit pre-handler; the application action has not run.
        const enforce = async () => {
            try { return await enforceRateLimit(req, res) }
            catch (error) {
                if ((error as { code?: string }).code === 'DB_QUEUE_FULL') {
                    const message = normalizeRequestPath(req) === '/api/rules/preview'
                        ? 'Preview is temporarily busy. Try again shortly.'
                        : 'Database is temporarily busy. Try again shortly.'
                    res.header('retry-after', '1')
                    res.status(503).send({ error: message })
                    return false
                }
                if (!isTransientDatabaseError(error) && (error as { code?: string }).code !== '25006') throw error
                await new Promise(resolve => setTimeout(resolve, 100))
                return enforceRateLimit(req, res, (error as { code?: string }).code === '25006')
            }
        }
        void enforce().then(proceed => {
            if (proceed) done()
        }, error => done(error as Error))
    })
})

async function enforceRateLimit(req: FastifyRequest, res: FastifyReply, databaseReadOnly = false) {
    let path = normalizeRequestPath(req)
    if (
        req.headers.upgrade?.toLowerCase() === 'websocket'
        || isInfrastructureWebSocketPath(path)
        || isBrowserStreamPath(path)
        || !path.startsWith('/api')
        || isTrustedStatusIngest(req, path)
    ) return true
    // Authentication and identity routes are served by the standalone Identity API.

    let phaseStarted = performance.now()
    if (path === '/api/cases/monitoring' || path === '/api/cases/monitoring/:id') req.caseBoundaryTiming = []
    const measure = (name: string) => {
        const now = performance.now()
        req.caseBoundaryTiming?.push(`${name};dur=${(now - phaseStarted).toFixed(2)}`)
        phaseStarted = now
    }
    const logIngest = req.method === 'POST' && path === '/api/logs/ingest' && (hasLogIngestToken(req) || hasInternalToken(req))
    const internalTokenRoute = internalTokenRoutes.get(`${req.method} ${path}`)
    let actor: RateLimitActor
    if (logIngest) actor = { scope: 'internal', identifier: 'service:log-ingest' }
    else if (internalTokenRoute && hasInternalToken(req)) actor = { scope: 'internal', identifier: internalTokenRoute }
    else if (req.method === 'GET' && path === '/api/thesis/code-reviews' && hasInternalToken(req)) actor = { scope: 'internal', identifier: 'service:code-review' }
    else actor = await resolveRateLimitActor(req)
    measure('session')
    if (actor.invalidApiKey) {
        sendBoundaryError(req, res, 401, 'invalid_api_key', 'The presented API key is invalid, disabled, or expired.')
        return false
    }
    if (actor.invalidSession) {
        sendBoundaryError(req, res, 401, 'invalid_session', 'The presented session is invalid or expired.')
        return false
    }
    let apiKeyScope: ReturnType<typeof matchApiKeyScope> = null
    if (actor.apiKey) {
        ;(req as FastifyRequest & { apiKeyAuth?: typeof actor.apiKey }).apiKeyAuth = actor.apiKey
        apiKeyScope = matchApiKeyScope(actor.apiKey.apiKey.scopes, req.method, path)
        if (!apiKeyScope) {
            sendBoundaryError(req, res, 403, 'scope_forbidden', 'API key is not allowed to access this endpoint.')
            return false
        }
        // Route aliases share the existing key's quota counters and configured limits.
        path = apiKeyScope.route
        // Service-account identity checks are safe to exempt from quota accounting.
        // This covers each configured monitor credential while keeping the scope
        // limited to the exact self-check route.
        if (actor.apiKey.serviceAccount
            && req.method === 'GET'
            && path === '/api/service-accounts/self') return true
    }

    const checkedSession = (req as FastifyRequest & { rateLimitSession?: Awaited<ReturnType<typeof validateSession>> }).rateLimitSession
    if (databaseReadOnly || recoveryReadOnly() || checkedSession?.session.database_read_only) {
        const now = Date.now()
        const bucket = recoveryBuckets.get(actor.identifier)
        if (!bucket || now >= bucket.resetAt) {
            if (recoveryBuckets.size >= 50_000) recoveryBuckets.delete(recoveryBuckets.keys().next().value!)
            recoveryBuckets.set(actor.identifier, { count: 1, resetAt: now + 60_000 })
            return true
        }
        bucket.count++
        if (bucket.count <= (actor.scope === 'anonymous' ? 90 : 1800)) return true
        res.header('Retry-After', Math.ceil((bucket.resetAt - now) / 1000))
        sendBoundaryError(req, res, 429, 'rate_limited', 'Too many requests during recovery. Please retry shortly.')
        return false
    }
    const settings = await getRateLimitSettings()
    measure('settings')
    if (!settings.enabled) return true

    const periodLimits = credentialPeriodLimits({
        actorIdentifier: actor.identifier,
        apiKeyScope,
        method: req.method,
        route: path,
    })
    if (periodLimits) {
        const periodChecks = await consumeCredentialPeriodBudgets({
            actorIdentifier: actor.identifier,
            method: req.method,
            route: path,
            limits: periodLimits,
        })

        applyCredentialLimitHeaders(res, periodChecks)
        const rejected = periodChecks
            .filter((check) => !check.allowed)
            .sort((left, right) => right.retryAfterMs - left.retryAfterMs)[0]
        if (rejected) {
            res.header('retry-after', String(Math.max(Math.ceil(rejected.retryAfterMs / 1000), 1)))
            sendBoundaryError(req, res, 429, 'rate_limit_exceeded', 'Credential rate limit exceeded.')
            return false
        }
    }

    const scopeRule = settings.defaults[actor.scope]
    const routeRule = resolveRouteRule(settings, req.method, path, actor.scope)
    const { globalCheck, routeCheck } = await consumeSharedRateLimitPair({
        key: `${actor.identifier}:global:${actor.scope}`, rule: scopeRule,
    }, {
        key: `${actor.identifier}:route:${actor.scope}:${req.method}:${path}`, rule: routeRule,
    })
    measure('quota')
    applyRateLimitHeaders(res, globalCheck, scopeRule, actor.scope, 'global')
    if (!routeCheck) {
        sendRateLimitExceeded(req, res, globalCheck, actor.scope, 'global')
        return false
    }

    applyRateLimitHeaders(res, routeCheck, routeRule, actor.scope, path)
    if (!routeCheck.allowed) {
        sendRateLimitExceeded(req, res, routeCheck, actor.scope, path)
        return false
    }
    return true
}
