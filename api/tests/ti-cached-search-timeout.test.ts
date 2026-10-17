import { afterEach, expect, spyOn, test } from 'bun:test'
import { searchThreatIntel } from '../src/utils/ti/search.ts'
const originalBase = process.env.TI_SCRAPER_API_BASE
const originalServiceToken = process.env.TI_SCRAPER_SERVICE_TOKEN
const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalBase
    if (originalServiceToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
    else process.env.TI_SCRAPER_SERVICE_TOKEN = originalServiceToken
})

test('cached actor search keeps the scraper request timeout separate from health preflight', async () => {
    process.env.TI_SCRAPER_API_BASE = 'https://ti.example.test'
    process.env.TI_SCRAPER_SERVICE_TOKEN = 'test-service-token'
    const requests: URL[] = []
    const requestSignals: AbortSignal[] = []
    const requestHeaders: Headers[] = []
    spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
        const url = new URL(String(input))
        requests.push(url)
        if (options?.signal) requestSignals.push(options.signal)
        requestHeaders.push(new Headers(options?.headers))
        if (url.pathname === '/v1/health') return Response.json({ status: 'ok' })
        return new Promise<Response>((resolve, reject) => {
            const timer = setTimeout(() => resolve(Response.json({ query: 'APT9876', summary: 'Catalog profile', sources: [], recentActivity: [], status: 'partial' })), 450)
            options?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(options.signal?.reason) }, { once: true })
        })
    })
    const response = await searchThreatIntel({ query: 'APT9876', preferCached: true, preflightHealth: true })
    expect(response.mode).toBe('scraper')
    expect(response.status).toBe('partial')
    expect(requests.map(url => url.pathname)).toEqual(['/v1/health', '/v1/intel/search'])
    expect(requests[1].searchParams.get('cached')).toBe('true')
    expect(requests[1].searchParams.get('q')).toBe('APT9876')
    expect(requests[1].searchParams.get('entityType')).toBe('actor')
    expect(requests[1].searchParams.get('limit')).toBe('50')
    expect(requestHeaders.map(headers => headers.get('x-hanasand-service-token'))).toEqual(['test-service-token', 'test-service-token'])
    expect(requestSignals).toHaveLength(2)
    expect(requestSignals[0]).not.toBe(requestSignals[1])
})
