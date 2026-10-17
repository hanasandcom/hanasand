// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { sanitizeTiResultForPublicPage, searchPublicTiResult } from '../src/app/ti/publicResult'
import searchThreatIntel from '../src/utils/ti/search'
import type { TiSearchResponse } from '../src/utils/ti/search'

test('public page projection keeps sourced catalog description, references and dates', () => {
    const candidate = { canonicalName: 'APT29', associatedNames: [], description: 'Catalog history.(Citation: Research 2026)', referenceSources: [{ name: 'Research 2026', url: 'https://example.com/report' }], createdAt: '2014-11-17', modifiedAt: '2026-08-05' }
    const result = { recentActivity: [], sources: [], actorIdentity: { candidates: [candidate] } } as unknown as TiSearchResponse
    expect(sanitizeTiResultForPublicPage(result)?.actorIdentity?.candidates[0]).toMatchObject(candidate)
})

test('public page projection preserves public references and drops private URLs', () => {
    const result = {
        recentActivity: [],
        sources: [
            { id: 'public', name: 'Public report', type: 'report', url: 'https://reports.example/public' },
            { id: 'private', name: 'Internal service', type: 'report', url: 'http://127.0.0.1/admin' },
        ],
        actorIdentity: {
            candidates: [{
                canonicalName: 'APT29',
                associatedNames: [],
                referenceSources: [
                    { name: 'Public reference', url: 'https://reports.example/apt29' },
                    { name: 'Internal reference', url: 'http://localhost/private' },
                ],
            }],
        },
    } as unknown as TiSearchResponse

    const projected = sanitizeTiResultForPublicPage(result)
    expect(projected?.sources[0]?.url).toBe('https://reports.example/public')
    expect(projected?.sources[1]?.url).toBeUndefined()
    expect(projected?.actorIdentity?.candidates[0]?.referenceSources).toContainEqual({
        name: 'Public reference',
        url: 'https://reports.example/apt29',
    })
    expect(JSON.stringify(projected)).not.toMatch(/127\.0\.0\.1|localhost/)
    expect(sanitizeTiResultForPublicPage(null)).toBeNull()
})

test('public search applies the same projection to fetched results as the server page', async () => {
    const originalFetch = globalThis.fetch
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const cached = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage: {
            getItem: (key: string) => cached.get(key) ?? null,
            setItem: (key: string, value: string) => cached.set(key, value),
            removeItem: (key: string) => cached.delete(key),
        } },
    })
    globalThis.fetch = async () => new Response(JSON.stringify({
        query: 'unique-public-search-projection-test',
        summary: 'Summary',
        recentActivity: [],
        sources: [{ id: 'private', name: 'Internal service', type: 'report', url: 'http://127.0.0.1/admin', reviewerNote: 'private note' }],
    }), { status: 200 })

    try {
        const result = await searchPublicTiResult('unique-public-search-projection-test', { bypassCache: true })
        expect(result?.sources[0]?.url).toBeUndefined()
        expect(JSON.stringify(result)).not.toContain('127.0.0.1')
        const publicCache = [...cached].find(([key]) => key.startsWith('hanasand:ti-search:scope:["public",'))
        expect(publicCache).toBeDefined()
        expect(publicCache?.[1]).not.toMatch(/private note|127\.0\.0\.1/)

        const cachedQuery = 'public-cache-hit-projection-test'
        const publicKey = `hanasand:ti-search:scope:${JSON.stringify(['public', cachedQuery])}`
        const expiresAt = Date.now() + 60_000
        cached.set(publicKey, JSON.stringify({ expiresAt, result: {
            query: cachedQuery, summary: 'Cached summary', recentActivity: [],
            sources: [{ id: 'cached', name: 'Internal', type: 'report', url: 'http://localhost/private', reviewerNote: 'cached secret' }],
        } }))
        let fetchCount = 0
        globalThis.fetch = async () => {
            fetchCount += 1
            return new Response(JSON.stringify({ query: 'public:public-cache-hit-projection-test', summary: 'Default result', recentActivity: [], sources: [] }), { status: 200 })
        }

        const cachedResult = await searchPublicTiResult(cachedQuery)
        expect(cachedResult?.sources[0]?.url).toBeUndefined()
        expect(fetchCount).toBe(0)
        expect(cached.get(publicKey)).not.toMatch(/cached secret|localhost/)
        expect(JSON.parse(cached.get(publicKey)!).expiresAt).toBe(expiresAt)

        const searchingQuery = 'public-searching-cache-test'
        const searchingKey = `hanasand:ti-search:scope:${JSON.stringify(['public', searchingQuery])}`
        cached.set(searchingKey, JSON.stringify({ expiresAt, result: {
            query: searchingQuery, summary: 'Searching', status: 'searching', recentActivity: [],
            sources: [{ id: 'internal', name: 'Internal', type: 'report', url: 'http://localhost/private' }],
        } }))
        expect((await searchPublicTiResult(searchingQuery))?.status).toBe('searching')
        expect(cached.has(searchingKey)).toBe(false)

        const defaultResult = await searchThreatIntel(`public:${cachedQuery}`)
        expect(defaultResult?.summary).toBe('Default result')
        expect(fetchCount).toBe(1)
    } finally {
        globalThis.fetch = originalFetch
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
        else Reflect.deleteProperty(globalThis, 'window')
    }
})
