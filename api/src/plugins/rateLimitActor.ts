import type { FastifyRequest } from 'fastify'
import { validateApiKey } from '#utils/auth/apiKeys.ts'
import { validateSession } from '#utils/auth/session.ts'
import { hasHanasandInternalPageAccess, HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPageAccess.ts'
import { canEditHanasandInternalPages } from '#utils/auth/organizationPagePolicy.ts'
import { verifiedClientIp } from '#utils/http/publicBoundary.ts'
import { withReadDatabase } from '#db'
import { deviceProofFromRequest, hasTrustedServerSession } from '#utils/auth/deviceProofRequest.ts'

export type RateLimitActor = {
    scope: RateLimitScope
    identifier: string
    apiKey?: Awaited<ReturnType<typeof validateApiKey>>
    invalidApiKey?: boolean
    invalidSession?: boolean
}

export async function resolveRateLimitActor(
    req: FastifyRequest,
    validate: typeof validateApiKey = validateApiKey,
    validateUserSession: typeof validateSession = validateSession,
): Promise<RateLimitActor> {
    const ip = verifiedClientIp(req)

    const apiKeySecret = extractPresentedApiKey(req)
    if (apiKeySecret) {
        const apiKey = await validate(apiKeySecret)
        if (apiKey) {
            return {
                scope: apiKey.apiKey.tier === 'internal' && apiKey.organizationId === HANASAND_ORGANIZATION_ID ? 'internal' : 'authenticated',
                identifier: `api_key:${apiKey.apiKey.id}`,
                apiKey,
            }
        }
        return { scope: 'anonymous', identifier: `ip:${ip}`, invalidApiKey: true }
    }

    const authHeader = req.headers.authorization
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        const headerId = Array.isArray(req.headers.id) ? req.headers.id[0] : req.headers.id
        const routePath = normalizeRequestPath(req)
        const organizationSlug = routePath === '/api/logs/tuning'
            || routePath.startsWith('/api/thesis')
            || routePath.startsWith('/api/code-reviews')
            ? 'hanasand' : undefined
        const session = await withReadDatabase(() => validateUserSession({
            id: typeof headerId === 'string' ? headerId : undefined,
            token,
            deviceProof: deviceProofFromRequest(req),
            trustedInternal: typeof headerId === 'string' && hasTrustedServerSession(req, headerId, token),
            ...(organizationSlug ? { organizationSlug } : {}),
        }))

        if (session) {
            ;(req as FastifyRequest & { rateLimitSession?: typeof session }).rateLimitSession = session
            const hasInternalPageAccess = session.organizationMembership !== undefined
                ? Boolean(session.organizationMembership && canEditHanasandInternalPages(session.organizationMembership))
                : await withReadDatabase(() => hasHanasandInternalPageAccess(session.user.id))

            return {
                scope: hasInternalPageAccess ? 'internal' : 'authenticated',
                identifier: `user:${session.user.id}`,
            }
        }

        return { scope: 'anonymous', identifier: `ip:${ip}`, invalidSession: true }
    }

    return {
        scope: 'anonymous',
        identifier: `ip:${ip}`,
    }
}

export function normalizeRequestPath(req: FastifyRequest) {
    const routePath = req.routeOptions?.url
    if (typeof routePath === 'string' && routePath.startsWith('/')) {
        return routePath
    }

    return req.url.split('?')[0] || '/'
}

function extractPresentedApiKey(req: FastifyRequest) {
    const xApiKey = req.headers['x-api-key']
    if (typeof xApiKey === 'string' && xApiKey.length) {
        return xApiKey
    }

    const authHeader = req.headers.authorization
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        if (token?.startsWith('hsk_')) {
            return token
        }
    }

    return ''
}
