import { expect, test } from 'bun:test'
import { classifyTiQuery, searchThreatIntel } from '#utils/ti/search.ts'

test('classifies public TI searches before selecting an enrichment path', () => {
    expect(classifyTiQuery('APT29')).toBe('actor')
    expect(classifyTiQuery('microsoft.com')).toBe('domain')
    expect(classifyTiQuery('CVE-2024-3094')).toBe('cve')
    expect(classifyTiQuery('203.0.113.10')).toBe('indicator')
})

test('falls back to local classification for an unknown scraper query kind', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    const originalFetch = globalThis.fetch
    const query = 'unknown-query-kind-404'
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    globalThis.fetch = async () => Response.json({
        query,
        queryKind: 'unexpected-kind',
        sources: [],
        recentActivity: [],
    })

    try {
        const result = await searchThreatIntel({ query })
        expect(result.queryKind).toBe('free_text')
    } finally {
        globalThis.fetch = originalFetch
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('uses one query classification for canonical scraper entity types', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    const originalFetch = globalThis.fetch
    const requestedUrls: URL[] = []
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    globalThis.fetch = async input => {
        const url = new URL(String(input))
        requestedUrls.push(url)
        return Response.json({
            query: url.searchParams.get('q'),
            generatedAt: '2026-10-16T10:00:00.000Z',
            mode: 'scraper',
            status: 'ready',
            summary: 'Canonical evidence is available.',
            confidence: 0.8,
            lastSeen: '2026-10-16T09:00:00.000Z',
            aliases: [], recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: [],
        })
    }

    try {
        const queries = [
            ['APT939991', 'actor', true],
            ['classification-check-992811.example', 'domain', false],
            ['CVE-2035-992811', 'cve', false],
            ['203.0.113.211', 'indicator', false],
            ['Hanasand Acme 992811', null, false],
        ] as const
        for (const [query, , preferCached] of queries) await searchThreatIntel({ query, preferCached })

        expect(requestedUrls.map(url => url.searchParams.get('entityType'))).toEqual(queries.map(([, entityType]) => entityType))
        expect(requestedUrls.map(url => url.searchParams.get('cached'))).toEqual(queries.map(([, , preferCached]) => preferCached ? 'true' : null))
    } finally {
        globalThis.fetch = originalFetch
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('keeps unavailable capabilities out of no-evidence results', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    delete process.env.TI_SCRAPER_API_BASE
    try {
        const result = await searchThreatIntel({ query: 'no-evidence-987654.example' })
        expect(result.datasets).toEqual([])
        expect(result.mode).toBe('unavailable')
        expect(result).not.toHaveProperty('collectionStrategy')
        expect(result.actionability?.watchlistCandidates).toEqual([{
            kind: 'domain',
            value: 'no-evidence-987654.example',
            reason: 'Exact domain supplied by the user; organization watchlists support domain terms.',
            confidence: 1,
        }])
    } finally {
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('does not synthesize an actor profile when canonical evidence is unavailable', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    delete process.env.TI_SCRAPER_API_BASE
    try {
        const result = await searchThreatIntel({ query: 'APT29' })
        expect(result.status).toBe('unavailable')
        expect(result.summary).toBe('Search unavailable')
        expect(result.confidence).toBe(0)
        expect(result.operationalStatus).toBeUndefined()
        expect(result.analystLoop).toBeUndefined()
        expect(result.aliases).toEqual([])
        expect(result.recentActivity).toEqual([])
        expect(result.targets).toEqual([])
        expect(result.ttps).toEqual([])
        expect(result.datasets).toEqual([])
        expect(result.sources).toEqual([])
        expect(result.actorIntelligence).toBeUndefined()
    } finally {
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})
