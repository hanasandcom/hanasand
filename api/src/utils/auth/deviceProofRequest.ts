import type { FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import config from '#constants'

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

// Scope this correction to the existing server-registered Watchlist handlers.
const watchlistProofRoutes = new Set([
    'GET /api/organizations/:id/watchlists',
    'GET /api/organizations/:organizationId/watchlists/:itemId',
    'GET /api/organizations/:id/watchlists/alert-terms',
    'POST /api/organizations/:id/watchlists',
    'POST /api/organizations/:id/watchlists/cleanup',
    'POST /api/organizations/:id/watchlists/reconcile',
    'PUT /api/organizations/:organizationId/watchlists/:itemId',
    'POST /api/organizations/:organizationId/watchlists/:itemId/actions',
    'DELETE /api/organizations/:organizationId/watchlists/:itemId',
])

function watchlistProofUrl(req: FastifyRequest) {
    const configured = process.env.NEXT_PUBLIC_API?.trim()
    let target: URL
    try { target = new URL(configured || 'https://api.hanasand.com') }
    catch { throw new Error('Invalid configured Watchlist proof origin.') }
    if (target.username || target.password || target.search || target.hash
        || configured?.includes('?') || configured?.includes('#') || (target.protocol !== 'https:' && target.protocol !== 'http:')) {
        throw new Error('Invalid configured Watchlist proof origin.')
    }
    const pathname = (req.raw?.url || req.url).split('?')[0]
    const invalidCharacter = [...pathname].some(character => character.charCodeAt(0) <= 32
        || character.charCodeAt(0) === 127 || character === '\\' || character === '#')
    if (!pathname.startsWith('/') || pathname.startsWith('//') || invalidCharacter) {
        throw new Error('Invalid Watchlist request target.')
    }
    const proofUrl = headerValue(req.headers['x-device-proof-url'])
    if (proofUrl) {
        let asserted: URL
        try { asserted = new URL(proofUrl) }
        catch { throw new Error('Invalid Watchlist proof target.') }
        const allowedOrigins = new Set(['https://hanasand.com', 'https://www.hanasand.com', 'https://api.hanasand.com'])
        if (target.protocol === 'https:') allowedOrigins.add(target.origin)
        if (asserted.protocol !== 'https:' || asserted.username || asserted.password || asserted.search || asserted.hash
            || asserted.pathname !== pathname || !allowedOrigins.has(asserted.origin)) {
            throw new Error('Invalid Watchlist proof target.')
        }
        const assertedMethod = headerValue(req.headers['x-device-proof-method'])
        if (assertedMethod && assertedMethod !== req.method.toUpperCase()) throw new Error('Invalid Watchlist proof target.')
        return `${asserted.origin}${pathname}`
    }
    // API containers can use an internal HTTP URL for server-to-server calls.
    // Device proofs always use the public HTTPS API origin.
    return `${target.protocol === 'https:' ? target.origin : 'https://api.hanasand.com'}${pathname}`
}

export function deviceProofFromRequest(req: FastifyRequest) {
    if (watchlistProofRoutes.has(`${req.method} ${req.routeOptions?.url}`)) {
        return {
            proof: headerValue(req.headers.dpop),
            method: req.method,
            url: watchlistProofUrl(req),
        }
    }
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
