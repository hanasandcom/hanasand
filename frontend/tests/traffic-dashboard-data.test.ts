// @ts-expect-error Bun provides the test module for focused checks.
import { afterAll, expect, mock, test } from 'bun:test'

mock.module('@/config', () => ({ default: { url: { cdn: 'https://cdn.example.test/api' } } }))
mock.module('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

let invalidResponse: 'domains' | 'metrics' | 'records' | null = null
const requested: string[] = []
const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: unknown) => {
    const url = String(input)
    requested.push(url)
    if (url.endsWith('/traffic/domains')) return Response.json(invalidResponse === 'domains' ? { items: [] } : { domains: ['example.test'] })
    if (url.includes('/traffic/metrics')) return Response.json(invalidResponse === 'metrics'
        ? { items: [] }
        : { top_domains: [], top_methods: [], top_status_codes: [] })
    return Response.json(invalidResponse === 'records' ? { items: [] } : { result: [], total: 0 })
}) as typeof fetch

const { getTrafficDashboardData } = await import('../src/utils/monitoring/data')
afterAll(() => { globalThis.fetch = originalFetch })

test('fetches the same selected-domain snapshot and page-sized record set', async () => {
    invalidResponse = null
    requested.length = 0
    const data = await getTrafficDashboardData('example.test')

    expect(data?.domains.domains).toEqual(['example.test'])
    expect(data?.records).toEqual({ result: [], total: 0 })
    expect(requested.map(url => new URL(url).pathname)).toEqual([
        '/api/traffic/domains', '/api/traffic/metrics', '/api/traffic/records',
    ])
    expect(new URL(requested[1]).searchParams.get('domain')).toBe('example.test')
    expect([...new URL(requested[2]).searchParams]).toEqual([
        ['limit', '200'], ['page', '1'], ['domain', 'example.test'],
    ])
})

test('rejects malformed upstream domains, metrics, and records', async () => {
    for (const resource of ['domains', 'metrics', 'records'] as const) {
        invalidResponse = resource
        expect(await getTrafficDashboardData('example.test')).toBeNull()
    }
})
