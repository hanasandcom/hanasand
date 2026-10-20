// @ts-expect-error Bun exposes the module mocking API to tests.
import { expect, mock, test } from 'bun:test'
import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookies, setAuthCookies } from '../src/app/api/auth/_authCookies'
import { authCookieOptions, setAuthCookie } from '../src/utils/proxy/authResponses'

const expiresAt = new Date('2030-01-02T03:04:05.000Z')

test('local auth cookies keep host-only scope and standard attributes', () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login')
    const response = new NextResponse(null)

    setAuthCookies(request, response, { id: 'user-1', name: 'Test', token: 'local-token', expires_at: expiresAt.toISOString() })

    const token = response.cookies.get('access_token')
    expect(token).toMatchObject({
        name: 'access_token', value: 'local-token', path: '/', secure: false,
        sameSite: 'lax', expires: expiresAt,
    })
    expect(token?.domain).toBeUndefined()
    expect(response.cookies.get('id')?.value).toBe('user-1')
    expect(response.cookies.get('avatar')?.value).toBe('')
    expect(response.headers.getSetCookie()).toContainEqual(expect.stringMatching(/^access_token=local-token; Path=\//))
})

test('shared auth cookies emit the configured shared-domain scope and attributes', () => {
    const request = new NextRequest('http://internal.test/api/auth/login', {
        headers: { host: 'internal.test', 'x-forwarded-host': 'app.hanasand.com:443, internal.test' },
    })
    const response = new NextResponse(null)

    setAuthCookies(request, response, { token: 'shared-token', expires_at: expiresAt.toISOString() })

    const tokenCookies = response.headers.getSetCookie().filter(cookie => cookie.startsWith('access_token='))
    expect(tokenCookies).toHaveLength(1)
    expect(tokenCookies[0]).toContain('Path=/')
    expect(tokenCookies[0]).toContain('Expires=Wed, 02 Jan 2030 03:04:05 GMT')
    expect(tokenCookies[0]).toContain('Domain=.hanasand.com')
    expect(tokenCookies[0]).toContain('Secure')
    expect(tokenCookies[0]).toContain('SameSite=lax')
})

test('shared writer honors host-derived options for backend token refreshes', () => {
    const request = new NextRequest('http://local.test/api/backend', {
        headers: { host: 'local.test' },
    })
    const response = new NextResponse(null)
    const { sharedDomain, ...options } = authCookieOptions(request)

    setAuthCookie(response, 'access_token', 'refreshed-token', { ...options, expires: expiresAt }, sharedDomain)

    expect(response.cookies.getAll()).toEqual([{
        name: 'access_token', value: 'refreshed-token', sameSite: 'lax',
        path: '/', secure: false, expires: expiresAt,
    }])
})

test('clearing auth expires local and legacy cookies with shared-domain scope', () => {
    const request = new NextRequest('https://app.hanasand.com/api/auth/logout')
    const response = new NextResponse(null)

    clearAuthCookies(request, response)

    const cookies = response.headers.getSetCookie()
    for (const name of ['name', 'id', 'avatar', 'access_token', 'session_expires_at', 'auth_checked_at']) {
        const hostCookie = cookies.find(cookie => cookie.startsWith(`${name}=`) && !cookie.includes('Domain='))
        expect(hostCookie).toContain('Path=/')
        expect(hostCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')

        const sharedCookie = cookies.find(cookie => cookie.startsWith(`${name}=`) && cookie.includes('Domain='))
        expect(sharedCookie).toContain('Path=/')
        expect(sharedCookie).toContain('Domain=.hanasand.com')
        expect(sharedCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
        expect(sharedCookie).toContain('SameSite=Lax')
        expect(sharedCookie).toContain('Secure')
    }
    const legacyCookie = cookies.find(cookie => cookie.startsWith('roles='))
    expect(legacyCookie).toContain('Path=/')
    expect(legacyCookie).toContain('Domain=.hanasand.com')
    expect(legacyCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
    expect(legacyCookie).toContain('SameSite=Lax')
    expect(legacyCookie).toContain('Secure')
})

mock.module('next/headers', () => ({
    cookies: async () => ({ get: (name: string) => ({ value: name === 'id' ? 'user-1' : 'session-token' }) }),
}))
mock.module('@/config', () => ({ default: { url: { api: 'https://api.example.test/api' } } }))
mock.module('@/utils/organizations/serverWorkspace', () => ({ activeOrganizationId: async () => null }))
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
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        forwardedHeaders = new Headers(init?.headers)
        return new Response('ok')
    }) as typeof fetch

    try {
        const request = new NextRequest('http://internal.test/api/backend/ai/conversations', {
            method: 'POST',
            headers: {
                authorization: 'Bearer fresh-token',
                id: 'fresh-user',
                'content-type': 'application/json',
            },
            body: '{}',
        })
        const response = await POST(request, { params: Promise.resolve({ path: ['ai', 'conversations'] }) })

        expect(response.status).toBe(200)
        expect(forwardedHeaders?.get('authorization')).toBe('Bearer fresh-token')
        expect(forwardedHeaders?.get('id')).toBe('fresh-user')
    } finally {
        globalThis.fetch = previousFetch
    }
})
