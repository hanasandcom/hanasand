import type { FastifyRequest } from 'fastify'
import hasInternalToken from '#utils/auth/internalToken.ts'

export const internalTokenRoutes = new Map<string, string>([
    ['GET /api/vms/names', 'service:vm-sync'],
    ['POST /api/vm', 'service:vm-sync'],
    ['POST /api/vm/details', 'service:vm-sync'],
    ['POST /api/vms/shutdown', 'service:vm-sync'],
    ['DELETE /api/vms', 'service:vm-sync'],
    ['POST /api/vms/internal/:name/provision', 'service:vm-provision'],
    ['GET /api/vms/internal/:name/status', 'service:vm-status'],
    ['POST /api/status/ingest', 'service:status-ingest'],
])

export const supportAuthPaths = new Set([
    '/auth/support/authorize',
    '/api/auth/support/authorize',
])

export function isInfrastructureWebSocketPath(path: string) {
    return path.startsWith('/api/client/ws/')
}

export function isBrowserStreamPath(path: string) {
    return path.startsWith('/api/browser-stream/')
}

export function isTrustedStatusIngest(req: FastifyRequest, path: string) {
    return req.method.toUpperCase() === 'POST'
        && path === '/api/status/ingest'
        && hasInternalToken(req)
}

export function resolveRouteRule(settings: RateLimitSettings, method: string, route: string, scope: RateLimitScope) {
    const override = settings.overrides.find((entry) =>
        entry.enabled
        && entry.scope === scope
        && entry.method === method.toUpperCase()
        && entry.route === route
    )

    if (override) {
        return {
            windowMs: override.windowMs,
            maxRequests: override.maxRequests,
        }
    }

    return settings.defaults[scope]
}
