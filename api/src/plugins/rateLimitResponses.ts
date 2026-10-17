import type { FastifyReply, FastifyRequest } from 'fastify'
import { normalizeRequestPath } from './rateLimitActor.ts'

export function applyRateLimitHeaders(
    res: FastifyReply,
    state: { remaining: number, resetAt: number },
    rule: RateLimitRule,
    scope: RateLimitScope,
    target: string,
) {
    res.header('x-rate-limit-limit', String(rule.maxRequests))
    res.header('x-rate-limit-remaining', String(state.remaining))
    res.header('x-rate-limit-reset', new Date(state.resetAt).toISOString())
    res.header('x-rate-limit-scope', scope)
    res.header('x-rate-limit-target', target)
}

export function sendRateLimitExceeded(
    req: FastifyRequest,
    res: FastifyReply,
    state: { retryAfterMs: number, resetAt: number },
    scope: RateLimitScope,
    target: string,
) {
    res.header('retry-after', String(Math.max(Math.ceil(state.retryAfterMs / 1000), 1)))
    if (normalizeRequestPath(req).startsWith('/api/v1')) return sendBoundaryError(req, res, 429, 'rate_limit_exceeded', 'Rate limit exceeded.')
    return res.status(429).send({
        error: 'Rate limit exceeded.',
        scope,
        target,
        retryAfterMs: state.retryAfterMs,
        resetAt: new Date(state.resetAt).toISOString(),
    })
}

export function sendBoundaryError(req: FastifyRequest, res: FastifyReply, status: number, code: string, message: string) {
    if (normalizeRequestPath(req).startsWith('/api/v1')) {
        res.header('cache-control', 'no-store, max-age=0')
        res.header('x-request-id', req.id)
        return res.status(status).send({ error: { code, message, requestId: req.id } })
    }
    return res.status(status).send({ error: code, message })
}
