import { afterEach, expect, test } from 'bun:test'
import { requestJson } from '../src/app/dashboard/rules/ruleRequest'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

test('adds JSON headers while preserving request options and caller headers', async () => {
    let captured: RequestInit | undefined
    globalThis.fetch = (async (_url, init) => {
        captured = init
        return Response.json({ rules: [] })
    }) as typeof fetch

    const result = await requestJson<{ rules: unknown[] }>('/api/rules', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
    })

    expect(result).toEqual({ rules: [] })
    expect(captured?.method).toBe('POST')
    expect(captured?.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
    })
})

test('uses API error messages and falls back to the HTTP status', async () => {
    globalThis.fetch = (async () => Response.json(
        { error: { message: 'Rule access denied.' } },
        { status: 403 },
    )) as typeof fetch
    await expect(requestJson('/api/rules')).rejects.toThrow('Rule access denied.')

    globalThis.fetch = (async () => new Response('invalid JSON', { status: 502 })) as typeof fetch
    await expect(requestJson('/api/rules')).rejects.toThrow('Request failed (502)')
})
