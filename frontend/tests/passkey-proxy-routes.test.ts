import { afterEach, expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

let cookieValues: Record<string, string> = {}
const requests: Array<{ url: string, init?: RequestInit }> = []
mock.module('next/headers', () => ({
    cookies: async () => ({ get: (name: string) => cookieValues[name] ? { value: cookieValues[name] } : undefined }),
}))
process.env.FRONTEND_IDENTITY_API = 'https://identity.example.test/api/'
const [{ GET: listPasskeys }, { GET: registerOptions }, { GET: authenticateOptions }, { PATCH: updateCredential, DELETE: deleteCredential }, { POST: registerVerify }] = await Promise.all([
    import('../src/app/api/auth/passkeys/route'),
    import('../src/app/api/auth/passkeys/register/options/route'),
    import('../src/app/api/auth/passkeys/authenticate/options/route'),
    import('../src/app/api/auth/passkeys/[credentialId]/route'),
    import('../src/app/api/auth/passkeys/register/verify/route'),
])
const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    cookieValues = {}
    requests.length = 0
})

test('public authentication options preserve query and do not add cookie auth', async () => {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return Response.json({ challenge: 'public-challenge' }, { status: 201 })
    }) as typeof fetch
    const response = await authenticateOptions(new NextRequest('https://site.test/api/auth/passkeys/authenticate/options?username=analyst'))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ challenge: 'public-challenge' })
    expect(requests[0]?.url).toBe('https://identity.example.test/api/auth/passkeys/authenticate/options?username=analyst')
    expect(requests[0]?.init?.cache).toBe('no-store')
    expect(requests[0]?.init?.headers).toBeUndefined()
})

test('cookie-authenticated enrollment and credential routes retain headers, method, body, and status', async () => {
    cookieValues = { access_token: 'cookie-token', id: 'user-4' }
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return Response.json({ error: 'Credential is already registered.' }, { status: 409 })
    }) as typeof fetch
    const enroll = await registerOptions()
    expect(enroll.status).toBe(409)
    expect(await enroll.json()).toEqual({ error: 'Credential is already registered.' })
    const enrollmentRequest = requests[0]!
    expect(enrollmentRequest.init?.cache).toBe('no-store')
    expect(new Headers(enrollmentRequest.init?.headers).get('Authorization')).toBe('Bearer cookie-token')
    expect(new Headers(enrollmentRequest.init?.headers).get('id')).toBe('user-4')

    const update = await updateCredential(new NextRequest('https://site.test/api/auth/passkeys/id', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Laptop' }),
    }), { params: Promise.resolve({ credentialId: 'key/one' }) })
    expect(update.status).toBe(409)
    const updateRequest = requests[1]!
    expect(updateRequest.url).toBe('https://identity.example.test/api/auth/passkeys/key%2Fone')
    expect(updateRequest.init?.method).toBe('PATCH')
    expect(new Headers(updateRequest.init?.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(updateRequest.init?.headers).get('Authorization')).toBe('Bearer cookie-token')
    expect(JSON.parse(String(updateRequest.init?.body))).toEqual({ name: 'Laptop' })
    expect(updateRequest.init?.cache).toBe('no-store')

    const deletion = await deleteCredential(new NextRequest('https://site.test/api/auth/passkeys/key/one', { method: 'DELETE' }), {
        params: Promise.resolve({ credentialId: 'key/one' }),
    })
    expect(deletion.status).toBe(409)
    const deletionRequest = requests[2]!
    expect(deletionRequest.url).toBe('https://identity.example.test/api/auth/passkeys/key%2Fone')
    expect(deletionRequest.init?.method).toBe('DELETE')
    expect(new Headers(deletionRequest.init?.headers).get('Authorization')).toBe('Bearer cookie-token')
    expect(new Headers(deletionRequest.init?.headers).get('id')).toBe('user-4')
    expect(new Headers(deletionRequest.init?.headers).get('Content-Type')).toBeNull()
    expect(deletionRequest.init?.body).toBeUndefined()
    expect(deletionRequest.init?.cache).toBe('no-store')
})

test('registration verification retains text body and maps malformed upstream JSON to empty object', async () => {
    cookieValues = { access_token: 'register-token', id: 'user-7' }
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return new Response('not json', { status: 503 })
    }) as typeof fetch
    const request = new NextRequest('https://site.test/api/auth/passkeys/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"credential":"proof"}',
    })
    const response = await registerVerify(request)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({})
    expect(requests[0]?.url).toBe('https://identity.example.test/api/auth/passkeys/register/verify')
    expect(requests[0]?.init?.method).toBe('POST')
    expect(requests[0]?.init?.body).toBe('{"credential":"proof"}')
    expect(new Headers(requests[0]?.init?.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(requests[0]?.init?.headers).get('Authorization')).toBe('Bearer register-token')
})

test('a rejected upstream fetch maps to the existing service unavailable response', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch
    const response = await listPasskeys()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Authentication service is unavailable.' })
})
