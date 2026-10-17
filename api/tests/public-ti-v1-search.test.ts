import { describe, expect, test } from 'bun:test'
import { searchResult, testApp } from './helpers/public-ti-v1.ts'

describe('public TI v1', () => {
    test('keeps single search anonymous and returns stable request-correlated failures', async () => {
        let searchCalls = 0
        const app = await testApp(undefined, async () => {
            searchCalls++
            return searchResult
        })
        const success = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })
        expect(success.statusCode).toBe(200)
        expect(success.json().query).toBe('APT29')
        expect(success.json().ttps).toEqual([expect.objectContaining({ extractionMethod: 'source_specific', extractorVersion: 'vendor-parser-v1' })])
        expect(success.json().recentActivity).toEqual([expect.objectContaining({ reviewState: 'needs_review', corroborationState: 'single_source', assertionKind: 'source_claim' })])
        expect(success.json().actorIntelligence.infrastructure).toEqual(['203.0.113.10', 'https://infra.example.test/path'])
        expect(success.body).not.toContain('news.google.com/rss/articles')
        expect(success.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
        expect(searchCalls).toBe(1)

        const shortQuery = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'x' } })
        expect(shortQuery.statusCode).toBe(400)
        expect(shortQuery.json()).toEqual({ error: { code: 'invalid_query', message: 'query must contain 2-200 characters.', requestId: shortQuery.headers['x-request-id'] } })
        expect(searchCalls).toBe(1)

        const unsupportedField = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29', tenantId: 'forbidden' } })
        expect(unsupportedField.statusCode).toBe(400)
        expect(unsupportedField.json()).toEqual({ error: { code: 'invalid_query', message: 'query must contain 2-200 characters.', requestId: unsupportedField.headers['x-request-id'] } })
        expect(searchCalls).toBe(1)
    })

    test('preflights scraper health for public search without changing the search payload contract', async () => {
        let request: { query: string, preflightHealth?: boolean } | undefined
        const app = await testApp(undefined, async input => {
            request = input
            return searchResult
        })

        const response = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: ' APT29 ' } })
        expect(response.statusCode).toBe(200)
        expect(request).toEqual({ query: 'APT29', preflightHealth: true })
        expect(response.json()).toMatchObject({ query: 'APT29', mode: 'scraper', status: 'ready' })
    })

    test('returns unavailable public search as HTTP 503 instead of a successful empty result', async () => {
        const app = await testApp(undefined, async () => ({
            ...searchResult,
            mode: 'unavailable' as const,
            status: 'ready' as const,
            summary: 'Search unavailable',
            confidence: 0,
            recentActivity: [],
            sources: [],
        }))

        const response = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })
        expect(response.statusCode).toBe(503)
        expect(response.json().error).toMatchObject({ code: 'search_unavailable' })
    })

    test('maps thrown public search failures to the same safe unavailable response', async () => {
        const app = await testApp(undefined, async () => { throw new Error('private upstream detail') })

        const response = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })
        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({
            error: {
                code: 'search_unavailable',
                message: 'Threat-intelligence search is temporarily unavailable.',
                requestId: response.headers['x-request-id'],
            },
        })
        expect(response.body).not.toContain('private upstream detail')
    })

    test('serializes scraper results with null or scalar nested entries without failing the request', async () => {
        const app = await testApp(undefined, async () => ({
            ...searchResult,
            recentActivity: [null, 'unexpected', searchResult.recentActivity[0]],
            targets: [null],
            ttps: ['unexpected'],
            datasets: [null],
            sources: [null],
            actionability: { ...searchResult.actionability, watchlistCandidates: [null, 'unexpected', { kind: 'domain', value: 'example.com', reason: 'direct', confidence: 0.8 }] },
        } as any))

        const response = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })
        expect(response.statusCode).toBe(200)
        expect(response.json().recentActivity).toHaveLength(1)
        expect(response.json().recentActivity[0]).toMatchObject({ title: 'Source mention' })
        expect(response.json().targets).toHaveLength(0)
        expect(response.json().ttps).toHaveLength(0)
        expect(response.json().datasets).toHaveLength(0)
        expect(response.json().sources).toHaveLength(0)
        expect(response.json().actionability.watchlistCandidates).toEqual([expect.objectContaining({ value: 'example.com' })])
    })

    test('removes restricted host locators from every public search URL surface', async () => {
        const app = await testApp(undefined, async () => ({
            ...searchResult,
            recentActivity: [{ ...searchResult.recentActivity[0], url: 'https://hidden.example.onion/report' }],
            datasets: [{ name: 'Restricted dataset', type: 'metadata_only', coverage: 'observed', status: 'metadata_only', url: 'https://hidden.example.i2p/dataset' }],
            sources: [{ ...searchResult.sources[0], url: 'https://hidden.example.onion/source' }],
            notes: ['Details at https://hidden.example.onion/notes'],
            actorIntelligence: { ...searchResult.actorIntelligence, infrastructure: ['https://hidden.example.onion/path', 'https://clear.example/report'], sourceProvenance: ['https://hidden.example.onion/provenance'] },
        }))

        const response = await app.inject({ method: 'POST', url: '/api/v1/ti/search', payload: { query: 'APT29' } })
        expect(response.statusCode).toBe(200)
        const body = response.json()
        expect(body.recentActivity[0]).not.toHaveProperty('url')
        expect(body.datasets[0]).not.toHaveProperty('url')
        expect(body.sources[0]).not.toHaveProperty('url')
        expect(body.actorIntelligence.infrastructure).toEqual(['https://clear.example/report'])
        expect(body.notes).toEqual(['Details at [restricted source]'])
        expect(body.actorIntelligence.sourceProvenance).toEqual(['[restricted source]'])
        expect(JSON.stringify(body)).not.toMatch(/\.onion|\.i2p/)
    })
})
