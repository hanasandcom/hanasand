import type { FastifyReply, FastifyRequest } from 'fastify'

const IDENTITY_SERVICE_URL = (process.env.HANASAND_IDENTITY_SERVICE_URL || 'http://identity:8081').replace(/\/+$/, '')
const forwardedRequestHeaders = [
    'accept',
    'authorization',
    'content-type',
    'cookie',
    'id',
    'origin',
    'referer',
    'user-agent',
    'x-impersonation-token',
]
const hopByHopResponseHeaders = new Set([
    'connection',
    'content-encoding',
    'content-length',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
])

export default async function proxyIdentityRequest(request: FastifyRequest, reply: FastifyReply) {
    const headers = new Headers()
    for (const name of forwardedRequestHeaders) {
        const value = request.headers[name]
        if (typeof value === 'string') headers.set(name, value)
        else if (Array.isArray(value)) headers.set(name, value.join(', '))
    }

    headers.set('x-forwarded-for', request.ip)
    if (request.headers.host) headers.set('x-forwarded-host', request.headers.host)
    headers.set('x-forwarded-proto', request.protocol)
    headers.set('x-real-ip', request.ip)

    const method = request.method.toUpperCase()
    let body: BodyInit | undefined
    if (method !== 'GET' && method !== 'HEAD' && request.body !== undefined) {
        if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) body = request.body
        else body = JSON.stringify(request.body)
    }

    try {
        const target = new URL(request.raw.url || request.url, IDENTITY_SERVICE_URL)
        const upstream = await fetch(target, {
            method,
            headers,
            body,
            redirect: 'manual',
            signal: AbortSignal.timeout(30_000),
        })
        reply.code(upstream.status)

        const upstreamHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] }
        for (const [name, value] of upstream.headers) {
            if (name === 'set-cookie' || hopByHopResponseHeaders.has(name)) continue
            reply.header(name, value)
        }
        const cookies = upstreamHeaders.getSetCookie?.()
            ?? (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')!] : [])
        if (cookies.length === 1) reply.header('set-cookie', cookies[0])
        else if (cookies.length > 1) reply.header('set-cookie', cookies)

        const responseBody = Buffer.from(await upstream.arrayBuffer())
        return reply.send(responseBody.length ? responseBody : undefined)
    } catch (error) {
        request.log.error({ err: error }, 'Identity service request failed')
        return reply.code(503).send({
            code: 'identity_unavailable',
            error: 'Authentication service is temporarily unavailable.',
        })
    }
}
