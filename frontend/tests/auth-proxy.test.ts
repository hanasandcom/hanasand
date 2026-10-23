// @ts-expect-error Bun exposes the module mocking API to tests.
import { expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

const expiresAt = new Date('2030-01-02T03:04:05.000Z')

mock.module('next/headers', () => ({
    cookies: async () => ({ get: (name: string) => ({ value: name === 'id' ? 'user-1' : 'session-token' }) }),
}))
mock.module('@/config', () => ({ default: { url: { api: 'https://api.example.test/api', ai: 'http://ai.example.test/api' } } }))
let activeOrganizationId: string | null = null
mock.module('@/utils/organizations/serverWorkspace', () => ({ activeOrganizationId: async () => activeOrganizationId }))
const { GET, POST } = await import('../src/app/api/backend/[...path]/route')

test('backend refresh cookie uses the response expiry through the shared route writer', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('ok', {
        headers: {
            'x-access-token': 'route-refreshed-token',
            'x-access-token-expires-at': expiresAt.toISOString(),
        },
    })) as typeof fetch

    try {
        const request = new NextRequest('http://internal.test/api/backend/vm/list', {
            headers: { 'x-forwarded-host': 'app.hanasand.com:443, internal.test' },
        })
        const response = await GET(request, { params: Promise.resolve({ path: ['vm', 'list'] }) })
        const tokenCookie = response.headers.getSetCookie().find(cookie => cookie.startsWith('access_token='))

        expect(response.status).toBe(200)
        expect(tokenCookie).toContain('route-refreshed-token')
        expect(tokenCookie).toContain('Expires=Wed, 02 Jan 2030 03:04:05 GMT')
        expect(tokenCookie).toContain('Domain=.hanasand.com')
        expect(tokenCookie).toContain('Path=/')
        expect(tokenCookie).toContain('Secure')
        expect(tokenCookie).toContain('SameSite=lax')
    } finally {
        globalThis.fetch = previousFetch
    }
})

test('backend proxy keeps VM lifecycle requests open for the host operation', async () => {
    const previousFetch = globalThis.fetch
    const previousTimeout = AbortSignal.timeout
    let timeoutMs = 0
    Object.defineProperty(AbortSignal, 'timeout', {
        configurable: true,
        value: (milliseconds: number) => {
            timeoutMs = milliseconds
            return previousTimeout(milliseconds)
        },
    })
    globalThis.fetch = (async () => new Response('{}')) as typeof fetch

    try {
        const request = new NextRequest('http://internal.test/api/backend/vm/slow-vm/restart', { method: 'POST' })
        const response = await GET(request, { params: Promise.resolve({ path: ['vm', 'slow-vm', 'restart'] }) })
        expect(response.status).toBe(200)
        expect(timeoutMs).toBeGreaterThanOrEqual(150_000)
    } finally {
        globalThis.fetch = previousFetch
        Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: previousTimeout })
    }
})

test('backend proxy prefers the current request credentials over stale cookies', async () => {
    const previousFetch = globalThis.fetch
    let forwardedHeaders: Headers | null = null
    let forwardedUrl = ''
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        forwardedUrl = String(input)
        forwardedHeaders = new Headers(init?.headers)
        return new Response('ok')
    }) as typeof fetch

    try {
        const request = new NextRequest('http://internal.test/api/backend/ai/conversations', {
            method: 'POST',
            headers: { authorization: 'Bearer fresh-token', id: 'fresh-user', 'content-type': 'application/json' },
            body: '{}',
        })
        const response = await POST(request, { params: Promise.resolve({ path: ['ai', 'conversations'] }) })

        expect(response.status).toBe(200)
        expect(forwardedUrl).toBe('http://ai.example.test/api/ai/conversations')
        expect(forwardedHeaders?.get('authorization')).toBe('Bearer fresh-token')
        expect(forwardedHeaders?.get('id')).toBe('fresh-user')
    } finally {
        globalThis.fetch = previousFetch
    }
})

test('backend VM list and metrics requests use the active organization instead of a client-supplied organization', async () => {
    const previousFetch = globalThis.fetch
    let forwardedHeaders: Headers | null = null
    activeOrganizationId = 'cashflow'
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        forwardedHeaders = new Headers(init?.headers)
        return new Response('[]')
    }) as typeof fetch

    try {
        const request = new NextRequest('http://internal.test/api/backend/vms/user-1', {
            headers: { 'x-organization-id': 'hanasand' },
        })
        const response = await GET(request, { params: Promise.resolve({ path: ['vms', 'user-1'] }) })

        expect(response.status).toBe(200)
        expect(forwardedHeaders?.get('x-organization-id')).toBe('cashflow')

        const metricsRequest = new NextRequest('http://internal.test/api/backend/vm/metrics', {
            headers: { 'x-organization-id': 'hanasand' },
        })
        const metricsResponse = await GET(metricsRequest, { params: Promise.resolve({ path: ['vm', 'metrics'] }) })

        expect(metricsResponse.status).toBe(200)
        expect(forwardedHeaders?.get('x-organization-id')).toBe('cashflow')
    } finally {
        activeOrganizationId = null
        globalThis.fetch = previousFetch
    }
})
