import { expect, test } from 'bun:test'
import config from '../src/config'
import { rateLimitHeaders, requestRateLimit } from '../src/app/dashboard/system/rates/rateLimitRequest'

const originalFetch = globalThis.fetch
const originalDocument = globalThis.document

function setCookies(cookie: string) {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie } })
}

test('rate-limit request preserves authenticated JSON request contracts', async () => {
    setCookies('access_token=token%2520value; id=user-1')
    const headers = rateLimitHeaders()
    let request: { url: string, init?: RequestInit } | undefined
    globalThis.fetch = (async (input, init) => {
        request = { url: String(input), init }
        return new Response(JSON.stringify({ saved: true }), { status: 200 })
    }) as typeof fetch

    try {
        const payload = await requestRateLimit<{ saved: boolean }>('/settings', headers!, {
            method: 'PUT',
            fallbackMessage: 'Unable to save.',
            body: { enabled: true },
        })
        expect(payload).toEqual({ saved: true })
        expect(request?.url).toBe(`${config.url.api}/rate-limit/settings`)
        expect(request?.init?.method).toBe('PUT')
        expect(request?.init?.headers).toEqual({
            Authorization: 'Bearer token value',
            id: 'user-1',
            'Content-Type': 'application/json',
        })
        expect(request?.init?.body).toBe(JSON.stringify({ enabled: true }))
    } finally {
        globalThis.fetch = originalFetch
        Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
    }
})

test('rate-limit request preserves API errors and supports bodyless deletion', async () => {
    setCookies('access_token=token; id=user-1')
    globalThis.fetch = (async (_input, init) => {
        expect(init?.method).toBe('DELETE')
        expect(init?.body).toBeUndefined()
        expect(init?.headers).toEqual({ Authorization: 'Bearer token', id: 'user-1' })
        return new Response(JSON.stringify({ error: 'Key is in use.' }), { status: 409 })
    }) as typeof fetch

    try {
        await expect(requestRateLimit('/keys/key-1', rateLimitHeaders()!, {
            method: 'DELETE',
            fallbackMessage: 'Unable to delete API key.',
        })).rejects.toThrow('Key is in use.')
    } finally {
        globalThis.fetch = originalFetch
        Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
    }
})

test('rate-limit API-key create and update send their original payloads', async () => {
    setCookies('access_token=token; id=user-1')
    const requests: Array<{ url: string, init?: RequestInit }> = []
    globalThis.fetch = (async (input, init) => {
        requests.push({ url: String(input), init })
        return new Response(JSON.stringify({ apiKey: { id: 'key-1' } }), { status: 200 })
    }) as typeof fetch

    try {
        const draft = { ownerId: 'owner-1', name: 'CI', tier: 'custom', enabled: true, expiresAt: null, scopes: [] }
        await requestRateLimit('/keys', rateLimitHeaders()!, {
            method: 'POST',
            fallbackMessage: 'Unable to create API key.',
            body: draft,
        })
        await requestRateLimit('/keys/key-1', rateLimitHeaders()!, {
            method: 'PUT',
            fallbackMessage: 'Unable to update API key.',
            body: { ...draft, name: 'CI updated' },
        })

        expect(requests.map(request => [request.url, request.init?.method, request.init?.body])).toEqual([
            [`${config.url.api}/rate-limit/keys`, 'POST', JSON.stringify(draft)],
            [`${config.url.api}/rate-limit/keys/key-1`, 'PUT', JSON.stringify({ ...draft, name: 'CI updated' })],
        ])
    } finally {
        globalThis.fetch = originalFetch
        Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
    }
})
