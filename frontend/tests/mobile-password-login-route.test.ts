import { afterEach, expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { POST } from '../src/app/api/auth/mobile/login/route'

const originalFetch = globalThis.fetch
const originalIdentityApi = process.env.FRONTEND_IDENTITY_API
process.env.FRONTEND_IDENTITY_API = 'https://identity.example.test/api/'

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalIdentityApi === undefined) delete process.env.FRONTEND_IDENTITY_API
    else process.env.FRONTEND_IDENTITY_API = originalIdentityApi
})

test('mobile password login forwards credentials to Identity and returns a non-cacheable token response', async () => {
    const fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe('https://identity.example.test/api/auth/login/analyst')
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({ password: 'secret' })
        expect(new Headers(init?.headers).get('content-type')).toBe('application/json')
        expect(init?.cache).toBe('no-store')
        return Response.json({ id: 'analyst', name: 'Analyst', token: 'session-token' })
    })
    globalThis.fetch = fetch as typeof fetch

    const response = await POST(new NextRequest('https://hanasand.com/api/auth/mobile/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ' analyst ', password: 'secret' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'analyst', name: 'Analyst', token: 'session-token' })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(fetch).toHaveBeenCalledTimes(1)
})

test('mobile password login rejects empty fields and malformed upstream sessions', async () => {
    const fetch = mock(async () => Response.json({ id: 'analyst', name: 'Analyst' }))
    globalThis.fetch = fetch as typeof fetch

    const missing = await POST(new NextRequest('https://hanasand.com/api/auth/mobile/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '', password: '' }),
    }))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'Username and password are required.' })
    expect(fetch).not.toHaveBeenCalled()

    globalThis.fetch = (async () => Response.json({ id: 'analyst', name: 'Analyst' })) as typeof fetch
    const malformed = await POST(new NextRequest('https://hanasand.com/api/auth/mobile/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'analyst', password: 'secret' }),
    }))
    expect(malformed.status).toBe(502)
})

test('mobile password login preserves Identity authentication errors', async () => {
    globalThis.fetch = (async () => Response.json({ error: 'Incorrect username or password.' }, { status: 401 })) as typeof fetch
    const response = await POST(new NextRequest('https://hanasand.com/api/auth/mobile/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'analyst', password: 'wrong' }),
    }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Incorrect username or password.' })
})
