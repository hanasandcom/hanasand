import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type SavedSearchBody = { query?: unknown }
type SavedSearch = { query: string; saved_at?: string; savedAt?: string }

export async function getSavedSearches(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) return res.status(401).send({ error: 'Unauthorized.' })
    try {
        const result = await requestTi('GET', userId)
        const rows = Array.isArray(result.savedSearches) ? result.savedSearches as SavedSearch[] : []
        return res.send({ savedSearches: rows.map(row => ({ query: row.query, savedAt: row.saved_at ?? row.savedAt })) })
    } catch {
        return res.status(503).send({ error: 'Threat-intelligence search is temporarily unavailable.' })
    }
}

export async function postSavedSearch(req: FastifyRequest<{ Body: SavedSearchBody }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) return res.status(401).send({ error: 'Unauthorized.' })
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
    if (!query || query.length > 200) return res.status(400).send({ error: 'Search query must be between 1 and 200 characters.' })
    try {
        const result = await requestTi('POST', userId, query)
        const savedSearch = result.savedSearch as SavedSearch
        return res.status(201).send({ savedSearch: { query: savedSearch.query, savedAt: savedSearch.saved_at ?? savedSearch.savedAt } })
    } catch {
        return res.status(503).send({ error: 'Threat-intelligence search is temporarily unavailable.' })
    }
}

export async function deleteSavedSearch(req: FastifyRequest<{ Querystring: { query?: string } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) return res.status(401).send({ error: 'Unauthorized.' })
    const query = typeof req.query?.query === 'string' ? req.query.query.trim() : ''
    if (!query) return res.status(400).send({ error: 'Search query is required.' })
    try {
        await requestTi('DELETE', userId, query)
        return res.send({ ok: true })
    } catch {
        return res.status(503).send({ error: 'Threat-intelligence search is temporarily unavailable.' })
    }
}

async function requestTi(method: 'GET' | 'POST' | 'DELETE', userId: string, query?: string) {
    const base = process.env.TI_SCRAPER_API_BASE?.trim().replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
    if (!base || !token) throw new Error('TI service is not configured')
    const url = new URL(`${base}/v1/internal/saved-searches`)
    url.searchParams.set('userId', userId)
    if (method === 'DELETE' && query) url.searchParams.set('query', query)
    const response = await fetch(url, {
        method,
        headers: {
            accept: 'application/json',
            'x-hanasand-service-token': token,
            ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify({ query }) } : {}),
        signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`TI service returned ${response.status}`)
    return await response.json() as Record<string, unknown>
}
