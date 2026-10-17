import type { FastifyRequest } from 'fastify'

type PublicRequest = FastifyRequest & {
    apiKeyAuth?: {
        organizationId?: string | null
        apiKey?: { organizationId?: string | null }
    }
    rateLimitSession?: unknown
}

export function apiKeyOrganizationId(req: FastifyRequest) {
    const auth = (req as PublicRequest).apiKeyAuth
    const value = auth?.organizationId ?? auth?.apiKey?.organizationId
    return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value) ? value : undefined
}

export function hasAuthenticatedPrincipal(req: FastifyRequest) {
    const request = req as PublicRequest
    return Boolean(request.apiKeyAuth || request.rateLimitSession)
}
