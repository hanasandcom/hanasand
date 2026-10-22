import type { FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import config from '#constants'

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

export function deviceProofFromRequest(req: FastifyRequest) {
    const forwardedHost = headerValue(req.headers['x-forwarded-host']) || headerValue(req.headers.host) || ''
    const protocol = headerValue(req.headers['x-forwarded-proto']) || req.protocol || 'https'
    return {
        proof: headerValue(req.headers.dpop),
        method: headerValue(req.headers['x-device-proof-method']) || req.method,
        url: headerValue(req.headers['x-device-proof-url']) || `${protocol}://${forwardedHost}${(req.url || '/').split('?')[0]}`,
    }
}

export function deviceProofFromWebSocket(req: FastifyRequest, proof: unknown) {
    const request = deviceProofFromRequest(req)
    return {
        proof: typeof proof === 'string' ? proof : undefined,
        method: 'GET',
        url: request.url.replace(/^http:/, 'https:'),
    }
}

export function devicePublicJwkFromRequest(req: FastifyRequest) {
    const value = headerValue(req.headers['x-device-public-jwk'])
    if (!value || value.length > 2048) return undefined
    try { return JSON.parse(value) as unknown } catch { return undefined }
}

export function hasTrustedServerSession(req: FastifyRequest, id: string, token: string) {
    const headers = req.headers as Record<string, string | string[] | undefined>
    const assertion = headerValue(headers['x-hanasand-server-session-assertion']) || ''
    const expected = config.vm_api_token || ''
    if (!expected || !assertion || assertion.length !== expected.length) return false
    return headerValue(headers['x-hanasand-server-session-validated']) === '1'
        && headerValue(headers['x-hanasand-server-session-id']) === id
        && headerValue(headers['x-hanasand-server-session-token']) === token
        && timingSafeEqual(Buffer.from(assertion), Buffer.from(expected))
}
