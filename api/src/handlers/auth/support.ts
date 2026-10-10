import type { FastifyReply, FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { validateSession } from '#utils/auth/session.ts'
import { validateApiKey, matchApiKeyScope } from '#utils/auth/apiKeys.ts'
import { hasHanasandInternalPageAccess } from '#utils/auth/organizationPageAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { queryOnce } from '#db'

type Input = { method?: unknown; path?: unknown; headers?: unknown; operation?: unknown; userId?: unknown }

function trustedService(request: FastifyRequest, reply: FastifyReply) {
    const expected = process.env.SUPPORT_AUTH_SERVICE_KEY || process.env.SUPPORT_SERVICE_KEY
    const received = request.headers['x-support-auth-key']
    if (!expected || expected.length < 32 || typeof received !== 'string'
        || Buffer.byteLength(received) !== Buffer.byteLength(expected)
        || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
        reply.code(403).send({ valid: false, error: 'Forbidden.' })
        return false
    }
    return true
}

export async function authorizeSupport(request: FastifyRequest<{ Body: Input }>, reply: FastifyReply) {
    if (!trustedService(request, reply)) return
    const { method, path, headers } = request.body || {}
    if (request.body?.operation === 'support-access') {
        const userId = request.body.userId
        if (typeof userId !== 'string' || userId.length > 200) return reply.code(400).send({ valid: false })
        return reply.send({ valid: true, support: await hasHanasandInternalPageAccess(userId) })
    }
    if (typeof method !== 'string' || !['GET', 'POST', 'OPTIONS'].includes(method.toUpperCase())
        || typeof path !== 'string' || !/^\/api\/(support|ws\/support)(\/|$)/.test(path)
        || !headers || typeof headers !== 'object' || Array.isArray(headers)) {
        return reply.code(400).send({ valid: false, error: 'Invalid support authorization request.' })
    }
    const auth = headers as Record<string, unknown>
    const apiSecret = typeof auth['x-api-key'] === 'string' ? auth['x-api-key'] as string : ''
    if (apiSecret) {
        const credential = await validateApiKey(apiSecret)
        if (!credential?.ownerId) return reply.code(401).send({ valid: false })
        if (request.body?.operation === 'validate-key') {
            return reply.send({ valid: true, id: credential.ownerId, ownerId: credential.ownerId,
                serviceAccount: credential.serviceAccount, apiKey: { scopes: credential.apiKey.scopes } })
        }
        const scope = matchApiKeyScope(credential.apiKey.scopes, method, path)
        if (!scope) return reply.code(403).send({ valid: false })
        const supportQueueScope = credential.serviceAccount && matchApiKeyScope(credential.apiKey.scopes, 'GET', '/api/support/tickets')
        const support = Boolean(supportQueueScope || await hasHanasandInternalPageAccess(credential.ownerId))
        const user = (await queryOnce('SELECT id,name FROM users WHERE id=$1 AND active IS TRUE AND deletion_scheduled_at IS NULL', [credential.ownerId])).rows[0]
        return reply.send({ valid: true, id: credential.ownerId, ownerId: credential.ownerId, authenticatedId: credential.ownerId,
            user: user ? { id: user.id, name: user.name } : undefined, support,
            serviceAccount: credential.serviceAccount, apiKey: { scopes: credential.apiKey.scopes } })
    }

    const authorization = typeof auth.authorization === 'string' ? auth.authorization : ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    const id = typeof auth.id === 'string' ? auth.id : undefined
    if (!token) return reply.code(401).send({ valid: false })
    const fakeHeaders = { authorization, ...(id ? { id } : {}), ...(typeof auth['x-impersonation-token'] === 'string' ? { 'x-impersonation-token': auth['x-impersonation-token'] as string } : {}) }
    const fakeRequest = { headers: fakeHeaders, method: method.toUpperCase(), url: path,
        routeOptions: { url: path }, ip: request.ip, log: request.log } as unknown as FastifyRequest
    let sent = false
    const responseHeaders: Record<string, string> = {}
    const fakeReply = {
        headers: responseHeaders, sent, statusCode: 200, log: request.log,
        header(name: string, value: string) { responseHeaders[name.toLowerCase()] = value; return this },
        status(code: number) { this.statusCode = code; return this },
        code(code: number) { this.statusCode = code; return this },
        send() { sent = true; this.sent = true; return this },
    } as unknown as FastifyReply
    const actor = await tokenWrapper(fakeRequest, fakeReply)
    if (!actor.valid || !actor.id) return reply.code(401).send({ valid: false, error: actor.error })
    const session = await validateSession({ id: actor.authenticatedId || id, token })
    if (!session) return reply.code(401).send({ valid: false })
    const effectiveUser = (await queryOnce('SELECT id,name FROM users WHERE id=$1 AND active IS TRUE AND deletion_scheduled_at IS NULL', [actor.id])).rows[0]
    if (!effectiveUser) return reply.code(401).send({ valid: false })
    const support = await hasHanasandInternalPageAccess(actor.id)
    for (const [name, value] of Object.entries(responseHeaders)) reply.header(name, value)
    return reply.send({ valid: true, id: actor.id, ownerId: actor.id, authenticatedId: actor.authenticatedId || session.user.id,
        impersonating: actor.impersonating === true, user: { id: effectiveUser.id, name: effectiveUser.name }, support,
        session: { token: session.session.token }, refreshed: session.refreshed })
}
