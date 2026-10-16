// @ts-expect-error Bun supplies this test module at runtime.
import { afterEach, expect, test } from 'bun:test'
import { emptyErrorEvents, getErrorEvents } from '../src/utils/logs/errorEvents'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('error events use an empty response when credentials are missing', async () => {
    globalThis.fetch = async () => { throw new Error('Fetch should not run') }

    const result = await getErrorEvents({ token: 'token' })

    expect(result.errors).toEqual([])
    expect(result.summary.total).toBe(0)
})

test('error events preserve rows and normalize summary counts', async () => {
    let request: { url: string, init?: RequestInit } | undefined
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        request = { url: String(input), init }
        return Response.json({
            generated_at: '2026-10-16T10:00:00.000Z',
            summary: { total: '3', last_hour: 2, server_errors: 'invalid', status_counts: [{ status_code: 503, count: 1 }] },
            errors: [{ id: 'event-1', message: 'Unavailable' }],
        })
    }) as typeof fetch

    const result = await getErrorEvents({ token: 'secret', id: 'user-1' })

    expect(request?.url).toContain('/logs/errors?limit=150')
    expect(request?.init?.headers).toEqual({ id: 'user-1', Authorization: 'Bearer secret' })
    expect(result).toMatchObject({
        generated_at: '2026-10-16T10:00:00.000Z',
        summary: { total: 3, last_hour: 2, server_errors: 0, status_counts: [{ status_code: 503, count: 1 }] },
        errors: [{ id: 'event-1', message: 'Unavailable' }],
    })
})

test('error events use the empty response for failed requests', async () => {
    globalThis.fetch = async () => new Response('', { status: 503 })

    const result = await getErrorEvents({ token: 'secret', id: 'user-1' })

    expect(result.errors).toEqual(emptyErrorEvents().errors)
    expect(result.summary.total).toBe(0)
})
