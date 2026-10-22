import type { FastifyRequest } from 'fastify'

// Only server-registered Identity handlers delegate authentication. API-owned
// organization handlers continue to authenticate in the core API.
export const identityProxyRouteConfig = { authenticationOwner: 'identity' } as const
const proxyPaths = new Set(['/api/auth/login-form.js', '/api/organizations', '/api/management/organizations'])

export function delegatesAuthenticationToIdentity(request: FastifyRequest) {
    const config = request.routeOptions?.config as { authenticationOwner?: unknown } | undefined
    return (
        request.method === 'GET' &&
        proxyPaths.has(request.routeOptions?.url || '') &&
        config?.authenticationOwner === 'identity'
    )
}

function header(request: FastifyRequest, name: string) {
    const value = request.headers[name]
    return typeof value === 'string' ? value : undefined
}

function publicOrigins() {
    const values = [
        'https://api.hanasand.com',
        'https://hanasand.com',
        'https://www.hanasand.com',
        process.env.NEXT_PUBLIC_API,
        process.env.PUBLIC_SITE_URL
    ]
    return new Set(
        values.flatMap((value) => {
            if (!value) return []
            try {
                const url = new URL(value)
                return url.protocol === 'https:' && !url.username && !url.password ? [url.origin] : []
            } catch {
                return []
            }
        })
    )
}

export function identityProxyProofHeaders(request: FastifyRequest, allowedOrigins = publicOrigins()) {
    const proof = header(request, 'dpop')
    if (!proof) return {}
    const method = request.method.toUpperCase()
    const pathname = (request.raw.url || request.url).split('?')[0]
    if (!proxyPaths.has(pathname) || method !== 'GET') throw new Error('invalid_device_proof_target')
    const assertedMethod = header(request, 'x-device-proof-method')
    if (assertedMethod && assertedMethod !== method) throw new Error('invalid_device_proof_target')
    // Fastify derives host/protocol using its configured trusted proxy boundary.
    // A forwarded public URL is allowed only for these same routes and origins.
    const target = new URL(
        header(request, 'x-device-proof-url') || `${request.protocol}://${request.host}${pathname}`
    )
    if (
        !allowedOrigins.has(target.origin) ||
        target.protocol !== 'https:' ||
        target.username ||
        target.password ||
        target.pathname !== pathname ||
        target.search ||
        target.hash
    )
        throw new Error('invalid_device_proof_target')
    return { DPoP: proof, 'x-device-proof-url': target.toString(), 'x-device-proof-method': method }
}
