import { getDeliverySummary } from '../../utils/ti/delivery.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { apiKeyOrganizationId, hasAuthenticatedPrincipal } from './publicTiAuth.ts'
import { sendError } from './publicTiErrors.ts'
import { publicActor, publicAlias, publicAlert, publicClaim, publicEvidence, publicEvaluation, publicIncident, publicSource, publicTimeliness, publicValidation, nonNegativeInteger } from './publicTiProjections.ts'

const RESOURCE_ROUTES = {
    '/actors': ['actor-profiles', 'actorProfiles', publicActor],
    '/aliases': ['actor-aliases', 'actorAliases', publicAlias],
    '/incidents': ['incidents', 'incidents', publicIncident],
    '/findings': ['claims', 'claims', publicClaim],
    '/evidence': ['evidence-links', 'evidenceLinks', publicEvidence],
    '/sources': ['sources', 'sources', publicSource],
    '/validations': ['validation-records', 'validationRecords', publicValidation],
    '/alerts': ['alerts', 'alerts', publicAlert],
    '/evaluation': ['evaluation-labels', 'evaluationLabels', publicEvaluation],
    '/timeliness': ['timeliness', 'timeliness', publicTimeliness],
} as const

export function registerPublicTiCollections(fastify: FastifyInstance, fetchImpl: typeof fetch) {
    for (const [route, [upstream, responseKey, project]] of Object.entries({ ...RESOURCE_ROUTES, '/claims': RESOURCE_ROUTES['/findings'] })) {
        fastify.get(route, async (req: FastifyRequest<{ Querystring: { q?: unknown, limit?: unknown, page?: unknown, cursor?: unknown, summary?: unknown } }>, reply) => {
            if (!hasAuthenticatedPrincipal(req)) return sendError(reply, req.id, 401, 'authentication_required', 'An API key or authenticated session is required.')
            if (route === '/timeliness' && req.query.summary === 'true') {
                try { return await getDeliverySummary(fetchImpl) }
                catch { return sendError(reply, req.id, 503, 'delivery_unavailable', 'Delivery metrics are unavailable.') }
            }
            const organizationId = apiKeyOrganizationId(req)
            if (route === '/alerts' && !organizationId) return sendError(reply, req.id, 403, 'organization_scope_required', 'Tenant-scoped alerts require an organization API key.')
            const query = parseCollectionQuery(req.query)
            if (!query.ok) return sendError(reply, req.id, 400, 'invalid_pagination', query.error)
            try {
                const upstreamPayload = await fetchCollection(fetchImpl, upstream, responseKey, query, route === '/alerts' ? organizationId : undefined)
                return {
                    data: upstreamPayload.records.map(project).filter(item => typeof item.id === 'string'),
                    pagination: {
                        page: query.page,
                        limit: query.limit,
                        total: upstreamPayload.total,
                        totalPages: Math.ceil(upstreamPayload.total / query.limit),
                        nextPage: query.cursor + query.limit < upstreamPayload.total ? query.page + 1 : null,
                        nextCursor: upstreamPayload.nextCursor ?? null,
                    },
                    meta: { requestId: req.id, ...(organizationId ? { organizationId } : {}) },
                }
            } catch {
                return sendError(reply, req.id, 503, 'upstream_unavailable', 'The intelligence data service is temporarily unavailable.')
            }
        })
    }
}

function parseCollectionQuery(query: { q?: unknown, limit?: unknown, page?: unknown, cursor?: unknown }) {
    const limit = query.limit === undefined ? 50 : Number(query.limit)
    if (query.page !== undefined && query.cursor !== undefined) return { ok: false as const, error: 'Use page without cursor.' }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { ok: false as const, error: 'limit must be an integer from 1 to 100.' }
    if (query.page !== undefined && !isUnsignedIntegerString(query.page)) return { ok: false as const, error: 'page must be a positive integer.' }
    const page = query.page === undefined ? 1 : Number(query.page)
    if (!Number.isSafeInteger(page) || page < 1) return { ok: false as const, error: 'page must be a positive integer.' }
    // Older clients send a numeric record offset; numbered pages use the same upstream contract.
    if (query.cursor !== undefined && !isUnsignedIntegerString(query.cursor)) return { ok: false as const, error: 'cursor must be a non-negative integer.' }
    const cursor = query.cursor === undefined ? (page - 1) * limit : Number(query.cursor)
    if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(cursor + limit)) return { ok: false as const, error: 'The requested page or cursor is out of range.' }
    if (query.q !== undefined && (typeof query.q !== 'string' || query.q.trim().length > 200)) return { ok: false as const, error: 'q must contain at most 200 characters.' }
    return { ok: true as const, limit, cursor, page: query.cursor === undefined ? page : Math.floor(cursor / limit) + 1, q: typeof query.q === 'string' ? query.q.trim() : '' }
}

function isUnsignedIntegerString(value: unknown): value is string {
    return typeof value === 'string' && /^\d+$/.test(value)
}

async function fetchCollection(
    fetchImpl: typeof fetch,
    upstream: string,
    responseKey: string,
    query: { limit: number, cursor: number, page: number, q: string },
    organizationId?: string,
) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    if (!base) throw new Error('TI_SCRAPER_API_BASE is not configured')
    const url = new URL(`${base}/v1/intel/${upstream}`)
    url.searchParams.set('limit', String(query.limit))
    if (query.cursor % query.limit) url.searchParams.set('cursor', String(query.cursor))
    else url.searchParams.set('page', String(query.page))
    if (query.q) url.searchParams.set('q', query.q)
    const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
    const response = await fetchImpl(url, {
        headers: {
            accept: 'application/json',
            ...(serviceToken ? { 'x-hanasand-service-token': serviceToken } : {}),
            ...(organizationId ? { 'x-tenant-id': organizationId } : {}),
        },
        signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`upstream returned ${response.status}`)
    const payload = await response.json() as Record<string, unknown>
    const records = Array.isArray(payload[responseKey]) ? payload[responseKey] as unknown[] : []
    return {
        records,
        total: nonNegativeInteger(payload.total) ?? records.length,
        nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : undefined,
    }
}
