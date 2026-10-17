import { expect, test } from 'bun:test'
import { searchThreatIntel } from '#utils/ti/search.ts'


test('retries canonical search after an unavailable response', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    const originalFetch = globalThis.fetch
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let attempts = 0
    globalThis.fetch = async () => {
        attempts++
        if (attempts === 1) return new Response(null, { status: 503 })
        return Response.json({
            query: 'APT7654320',
            generatedAt: '2026-07-24T12:00:00.000Z',
            mode: 'scraper',
            status: 'ready',
            summary: 'Canonical evidence is available.',
            confidence: 0.8,
            lastSeen: '2026-07-24T11:00:00.000Z',
            aliases: [],
            recentActivity: [],
            targets: [],
            ttps: [],
            datasets: [],
            sources: [],
            notes: [],
        })
    }

    try {
        expect((await searchThreatIntel({ query: 'APT7654320' })).mode).toBe('unavailable')
        expect((await searchThreatIntel({ query: 'APT7654320' })).mode).toBe('scraper')
        expect(attempts).toBe(2)
    } finally {
        globalThis.fetch = originalFetch
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('reports whether a search was served from the in-process cache', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    const originalFetch = globalThis.fetch
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let attempts = 0
    globalThis.fetch = async () => {
        attempts++
        return Response.json({
            query: 'cache-status-987654', generatedAt: '2026-08-09T06:00:00.000Z', mode: 'scraper', status: 'ready',
            summary: 'Evidence is available.', confidence: 0.8, lastSeen: '2026-08-09T05:00:00.000Z', aliases: [],
            recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: [],
        })
    }

    try {
        expect((await searchThreatIntel({ query: 'cache-status-987654' })).cacheStatus).toBe('miss')
        expect((await searchThreatIntel({ query: 'cache-status-987654' })).cacheStatus).toBe('hit')
        expect(attempts).toBe(1)
    } finally {
        globalThis.fetch = originalFetch
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('bounds the in-process search cache and evicts its oldest entry', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    const originalFetch = globalThis.fetch
    let attempts = 0
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    globalThis.fetch = async input => {
        attempts++
        const query = new URL(String(input)).searchParams.get('q') ?? ''
        return Response.json({
            query,
            generatedAt: '2026-10-16T10:00:00.000Z',
            mode: 'scraper',
            status: 'ready',
            summary: 'Evidence is available.',
            confidence: 0.8,
            lastSeen: '2026-10-16T09:00:00.000Z',
            aliases: [], recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: [],
        })
    }

    try {
        for (let index = 0; index <= 500; index++) {
            await searchThreatIntel({ query: `cache-capacity-${index}.example` })
        }

        const result = await searchThreatIntel({ query: 'cache-capacity-0.example' })
        expect(result.cacheStatus).toBe('miss')
        expect(attempts).toBe(502)
    } finally {
        globalThis.fetch = originalFetch
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('refreshes a cached pending search before its advertised poll interval', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    const originalFetch = globalThis.fetch
    const originalNow = Date.now
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let now = 1_786_194_000_000
    let attempts = 0
    Date.now = () => now
    globalThis.fetch = async () => {
        attempts++
        return Response.json({
            query: 'pending-cache-987654',
            generatedAt: '2026-08-08T13:00:00.000Z',
            mode: 'scraper',
            status: attempts === 1 ? 'searching' : 'ready',
            refreshAfterSeconds: 15,
            summary: attempts === 1 ? 'Collection is in progress.' : 'Collection completed with no matching evidence.',
            confidence: 0,
            aliases: [], recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: [],
        })
    }

    try {
        expect((await searchThreatIntel({ query: 'pending-cache-987654' })).status).toBe('searching')
        expect((await searchThreatIntel({ query: 'pending-cache-987654' })).status).toBe('searching')
        expect(attempts).toBe(1)
        now += 5_001
        expect((await searchThreatIntel({ query: 'pending-cache-987654' })).status).toBe('ready')
        expect(attempts).toBe(2)
    } finally {
        Date.now = originalNow
        globalThis.fetch = originalFetch
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})
