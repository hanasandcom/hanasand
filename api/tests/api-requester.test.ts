import { afterEach, expect, test } from 'bun:test'
import { createApiRequester } from '../scripts/helpers/apiRequester.mjs'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

test('merges JSON request headers and parses JSON or plain-text responses', async () => {
    const requests: Array<{ url: string, init: RequestInit }> = []
    globalThis.fetch = (async (input, init = {}) => {
        requests.push({ url: String(input), init })
        return requests.length === 1
            ? Response.json({ ok: true })
            : requests.length === 2
                ? new Response('upstream unavailable', { status: 503 })
                : new Response(null, { status: 204 })
    }) as typeof fetch
    const request = createApiRequester('https://api.example.test/api')

    const json = await request('/one', { method: 'POST', body: '{}', headers: { Authorization: 'Bearer token' } })
    const plainText = await request('/two')
    const empty = await request('/three', { method: 'POST', body: 'payload', headers: { 'Content-Type': 'text/plain' } })

    expect(requests[0]).toEqual({
        url: 'https://api.example.test/api/one',
        init: { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' } },
    })
    expect(json.body).toEqual({ ok: true })
    expect(plainText.body).toBe('upstream unavailable')
    expect(plainText.response.status).toBe(503)
    expect(requests[2].init.headers).toEqual({ 'Content-Type': 'text/plain' })
    expect(empty.body).toBeNull()
})
