import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify'
import { publicTiOpenApi } from '../../contracts/publicTiOpenApi.ts'
import { normalizeBatchQueries, normalizeTiSearchQuery, TI_BATCH_MAX_QUERIES } from './search.ts'
import { registerPublicTiCollections } from './publicTiCollections.ts'
import { hasAuthenticatedPrincipal } from './publicTiAuth.ts'
import { normalizeError, publicError, sendError } from './publicTiErrors.ts'
export { normalizeError } from './publicTiErrors.ts'
import { executePublicSearch } from './publicTiSearchProjection.ts'
import { searchThreatIntel } from '#utils/ti/search.ts'

type PublicApiOptions = FastifyPluginOptions & {
    fetchImpl?: typeof fetch
    searchImpl?: typeof searchThreatIntel
}

const SEARCH_UNAVAILABLE = {
    status: 503,
    code: 'search_unavailable',
    message: 'Threat-intelligence search is temporarily unavailable.',
} as const

export default async function publicTiApi(fastify: FastifyInstance, options: PublicApiOptions) {
    const fetchImpl = options.fetchImpl ?? fetch
    const searchImpl = options.searchImpl ?? searchThreatIntel

    fastify.addHook('onSend', async (req, reply, payload) => {
        reply.header('cache-control', 'no-store, max-age=0')
        reply.header('pragma', 'no-cache')
        reply.header('x-request-id', req.id)
        if (reply.statusCode < 400) return payload
        reply.type('application/json; charset=utf-8')
        return JSON.stringify(normalizeError(payload, reply.statusCode, req.id))
    })

    fastify.setErrorHandler((cause, req, reply) => {
        const error = cause as { statusCode?: number }
        const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500
        return sendError(reply, req.id, status, status === 400 ? 'invalid_request' : 'internal_error', status === 400 ? 'The request body is invalid.' : 'The request could not be completed.')
    })

    fastify.get('/openapi.json', async () => publicTiOpenApi)

    fastify.post('/ti/search', async (req: FastifyRequest<{ Body: { query?: unknown } }>, reply) => {
        const query = normalizeQueryBody(req.body)
        if (!query) return sendError(reply, req.id, 400, 'invalid_query', 'query must contain 2-200 characters.')
        const result = await executePublicSearch(searchImpl, query)
        if (result.status === 'unavailable') return sendError(reply, req.id, SEARCH_UNAVAILABLE.status, SEARCH_UNAVAILABLE.code, SEARCH_UNAVAILABLE.message)
        return result.value
    })

    fastify.post('/ti/search/batch', async (req: FastifyRequest<{ Body: { queries?: unknown } }>, reply) => {
        if (!hasAuthenticatedPrincipal(req)) return sendError(reply, req.id, 401, 'authentication_required', 'An API key or authenticated session is required.')
        if (!hasOnlyAllowedFields(req.body, ['queries'])) {
            return sendError(reply, req.id, 400, 'invalid_request', 'batch search accepts only the queries field.')
        }
        if (Array.isArray(req.body.queries) && req.body.queries.length > TI_BATCH_MAX_QUERIES) {
            return sendError(reply, req.id, 400, 'too_many_queries', `batch search accepts at most ${TI_BATCH_MAX_QUERIES} input queries.`)
        }
        const queries = normalizeBatchQueries(req.body.queries)
        if (!queries.length) return sendError(reply, req.id, 400, 'invalid_queries', 'queries must contain values of 2-200 characters.')

        const results = await mapConcurrent(queries, 3, async query => {
            const result = await executePublicSearch(searchImpl, query)
            if (result.status === 'unavailable') {
                return { query, status: 'error' as const, error: publicError(SEARCH_UNAVAILABLE.code, SEARCH_UNAVAILABLE.message, req.id) }
            }
            return { query, status: 'ok' as const, result: result.value }
        })
        const partial = results.some(result => result.status === 'error')
        return reply.status(partial ? 207 : 200).send({ generatedAt: new Date().toISOString(), count: results.length, partial, results })
    })

    registerPublicTiCollections(fastify, fetchImpl)
}

function normalizeQueryBody(body: { query?: unknown } | undefined) {
    if (!hasOnlyAllowedFields(body, ['query'])) return ''
    return normalizeTiSearchQuery(body?.query)
}

function hasOnlyAllowedFields(value: unknown, allowedFields: readonly string[]) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowedFields.includes(key)))
}


async function mapConcurrent<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
    const results = new Array<R>(items.length)
    let index = 0
    async function worker() {
        while (index < items.length) {
            const current = index++
            results[current] = await mapper(items[current])
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
    return results
}
