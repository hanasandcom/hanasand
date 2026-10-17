import { describe, expect, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'
import postTiSearch, { normalizeBatchQueries, sanitizeBrowserSearchResult } from '../src/handlers/ti/search.ts'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createPublicApiReply } from './fixtures/publicApiReply.ts'

describe('public TI search boundary', () => {
    test('normalizes unique bounded queries', () => {
        expect(normalizeBatchQueries([' APT29 ', 'apt29', 'CVE-2024-3094', '', 12])).toEqual(['APT29', 'CVE-2024-3094'])
        expect(normalizeBatchQueries(['x', 'x'.repeat(201)])).toEqual([])
    })

    test('returns a truthful unavailable result for an anonymous search', async () => {
        const previous = process.env.TI_SCRAPER_API_BASE
        delete process.env.TI_SCRAPER_API_BASE
        try {
            const single = createPublicApiReply()
            const singleResult = await postTiSearch({ body: { query: 'APT29' } } as FastifyRequest<{ Body: { query: string } }>, single as unknown as FastifyReply) as any
            expect(singleResult.statusCode).toBe(503)
            expect(singleResult.payload.query).toBe('APT29')
            expect(singleResult.payload.status).toBe('unavailable')
            expect(singleResult.headers['cache-control']).toBe('no-store, max-age=0')
            expect(singleResult.headers.pragma).toBe('no-cache')
            for (const field of ['planner', 'graph', 'publicChannel', 'restrictedMetadata', 'darknetMetadata']) {
                expect(singleResult.payload).not.toHaveProperty(field)
            }
        } finally {
            if (previous === undefined) delete process.env.TI_SCRAPER_API_BASE
            else process.env.TI_SCRAPER_API_BASE = previous
        }

        const tooShort = await postTiSearch({ body: { query: ' x ' } } as FastifyRequest<{ Body: { query: string } }>, createPublicApiReply() as unknown as FastifyReply) as any
        expect(tooShort.statusCode).toBe(400)
        expect(tooShort.payload.error).toBe('invalid_query')

        const unexpected = createPublicApiReply()
        const unexpectedResult = await postTiSearch({ body: { query: 'APT29', tenantId: 'other' } } as any, unexpected as unknown as FastifyReply) as any
        expect(unexpectedResult.statusCode).toBe(400)
        expect(unexpectedResult.payload.error).toBe('invalid_request')
    })

    test('does not expose scraper planning or restricted-operation internals through the browser search', () => {
        const result = sanitizeBrowserSearchResult({
            query: 'APT29',
            sources: [{ id: 'src-public' }],
            analystLoop: { resultState: 'ready' },
            planner: { blockedSourceCount: 83, recommendedSourceActivations: [{ sourceId: 'src-internal' }] },
            graph: { endpoint: '/v1/intel/search.graph', reviewQueue: { total: 44 } },
            publicChannel: { activationRecommendations: [{ sourceId: 'src-internal' }] },
            restrictedMetadata: { results: [] },
            darknetMetadata: { results: [] },
        })

        expect(result).toMatchObject({ query: 'APT29', sources: [{ id: 'src-public' }], analystLoop: { resultState: 'ready' } })
        for (const field of ['planner', 'graph', 'publicChannel', 'restrictedMetadata', 'darknetMetadata']) {
            expect(result).not.toHaveProperty(field)
        }
        expect(JSON.stringify(result)).not.toContain('src-internal')
    })

    test('registers batch search only through the canonical versioned API', () => {
        const apiDirectory = path.resolve(import.meta.dir, '..')
        const routeCheck = `
            const assert = require('node:assert/strict')
            const { default: Fastify } = await import('fastify')
            const { default: apiRoutes } = await import('./src/routes.ts')
            const { default: publicTiApi } = await import('./src/handlers/ti/publicApi.ts')
            const app = Fastify({ logger: false })
            try {
                await app.register(apiRoutes, { prefix: '/api' })
                await app.register(publicTiApi, { prefix: '/api/v1' })
                await app.ready()
                assert.equal(app.hasRoute({ method: 'POST', url: '/api/v1/ti/search/batch' }), true)
                assert.equal(app.hasRoute({ method: 'POST', url: '/ti/search/batch' }), false)
                assert.equal(app.hasRoute({ method: 'POST', url: '/api/ti/search/batch' }), false)
                console.log('Batch TI search is registered only on the canonical versioned route.')
            } finally {
                await app.close()
            }
        `
        const result = spawnSync(process.execPath, ['-e', routeCheck], {
            cwd: apiDirectory,
            env: { ...process.env, API_HTTP_ONLY: '1' },
            encoding: 'utf8',
            timeout: 15_000,
        })

        expect(result.error).toBeUndefined()
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('Batch TI search is registered only on the canonical versioned route.')
        expect(existsSync(fileURLToPath(new URL('../../frontend/src/app/api/ti/search/batch/route.ts', import.meta.url)))).toBe(false)
    })
})
