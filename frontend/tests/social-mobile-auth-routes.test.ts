import { strict as assert } from 'node:assert'
import { afterEach, test } from 'node:test'
import { NextRequest } from 'next/server'
import { callback, providers, start } from '../src/app/api/auth/social/proxy'

const originalFetch = globalThis.fetch
const challenge = 'c'.repeat(43)
const binding = 'b'.repeat(43)
const authCode = 'a'.repeat(43)

afterEach(() => {
    globalThis.fetch = originalFetch
})

test('mobile Google start validates PKCE before contacting Identity', async () => {
    let requests = 0
    globalThis.fetch = (async () => {
        requests += 1
        return new Response('{}', { status: 200 })
    }) as typeof fetch

    const response = await start(new NextRequest('https://hanasand.com/api/auth/social/google/start?mobile_challenge=bad'), 'google')
    assert.equal(response.status, 400)
    assert.equal(requests, 0)
})

test('mobile Google start carries the PKCE challenge in a secure short-lived cookie', async () => {
    let requestBody: Record<string, unknown> | undefined
    globalThis.fetch = (async (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=state' }), {
            status: 200,
            headers: { 'Set-Cookie': `hanasand_auth_binding=${binding}; Path=/; Secure; HttpOnly; SameSite=None` },
        })
    }) as typeof fetch

    const response = await start(new NextRequest(`https://hanasand.com/api/auth/social/google/start?mobile_challenge=${challenge}`), 'google')
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), 'https://accounts.google.com/o/oauth2/v2/auth?state=state')
    assert.equal(requestBody?.link, false)
    assert.equal(requestBody?.mobileChallenge, challenge)
    const mobileCookie = response.cookies.get('__Host-social-mobile-google')
    assert.equal(mobileCookie?.value, challenge)
    assert.equal(mobileCookie?.httpOnly, true)
    assert.equal(mobileCookie?.secure, true)
    assert.equal(mobileCookie?.sameSite, 'none')
    assert.ok(response.cookies.get('hanasand_auth_binding')?.value)
    assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('mobile Google callback redirects the provider-verified Identity code without a second bearer authorization', async () => {
    const calls: Array<{ url: string, body: Record<string, unknown>, headers: Headers }> = []
    globalThis.fetch = (async (input, init) => {
        const headers = new Headers(init?.headers)
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        const url = String(input)
        calls.push({ url, body, headers })
        return new Response(JSON.stringify({ mobileCode: authCode, expiresIn: 90 }), { status: 200 })
    }) as typeof fetch

    const request = new NextRequest('https://hanasand.com/api/auth/social/google/callback?code=google-code&state=s'.replace('state=s', `state=${'s'.repeat(43)}`), {
        headers: { cookie: `hanasand_auth_binding=${binding}; __Host-social-mobile-google=${challenge}` },
    })
    const response = await callback(request, 'google')

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), `hanasand://social?code=${authCode}`)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /\/auth\/social\/google\/callback$/)
    assert.equal(calls[0].body.binding, binding)
    assert.equal(calls[0].headers.has('authorization'), false)
    assert.deepEqual(calls[0].body, { code: 'google-code', state: 's'.repeat(43), binding, cancelled: false })
    assert.equal(response.cookies.get('__Host-social-mobile-google')?.value, '')
    assert.equal(response.cookies.get('access_token'), undefined)
})

test('mobile callbacks reject a temporary bearer session instead of replaying callback device proof', async () => {
    let calls = 0
    globalThis.fetch = (async () => {
        calls += 1
        return new Response(JSON.stringify({ id: 'user-1', token: 'synthetic-temporary-token' }), { status: 200 })
    }) as typeof fetch
    const response = await callback(new NextRequest('https://hanasand.com/api/auth/social/google/callback?code=synthetic&state=synthetic', {
        headers: { cookie: `hanasand_auth_binding=${binding}; __Host-social-mobile-google=${challenge}`, dpop: 'synthetic-proof-for-old-token' },
    }), 'google')
    assert.equal(calls, 1)
    assert.match(response.headers.get('location') || '', /socialError=/)
    assert.equal(response.cookies.get('access_token'), undefined)
})

test('mobile code needs the start cookie and cannot accompany a bearer token', async () => {
    for (const [cookie, payload] of [
        ['', { mobileCode: authCode }],
        [`__Host-social-mobile-google=${challenge}`, { mobileCode: authCode, token: 'unexpected-synthetic-token' }],
    ] as const) {
        globalThis.fetch = (async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch
        const response = await callback(new NextRequest('https://hanasand.com/api/auth/social/google/callback?code=synthetic&state=synthetic', { headers: { cookie } }), 'google')
        assert.match(response.headers.get('location') || '', /socialError=/)
        assert.equal(response.cookies.get('access_token'), undefined)
    }
})

test('mobile sign-in cannot also link another account', async () => {
    let calls = 0
    globalThis.fetch = (async () => { calls += 1; return new Response('{}') }) as typeof fetch
    const response = await start(new NextRequest(`https://hanasand.com/api/auth/social/google/start?mobile_challenge=${challenge}`, { method: 'POST', headers: { origin: 'https://hanasand.com' } }), 'google')
    assert.equal(response.status, 400)
    assert.equal(calls, 0)
})

test('provider status route forwards configuration and disables caching', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ providers: [{ provider: 'google', configured: false }] }), {
        status: 200,
    })) as typeof fetch

    const response = await providers()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { providers: [{ provider: 'google', configured: false }] })
})

test('unknown providers cannot start or complete mobile sign-in', async () => {
    const startResponse = await start(new NextRequest(`https://hanasand.com/api/auth/social/unknown/start?mobile_challenge=${challenge}`), 'unknown')
    const callbackResponse = await callback(new NextRequest('https://hanasand.com/api/auth/social/unknown/callback?code=x&state=y'), 'unknown')
    assert.equal(startResponse.status, 404)
    assert.equal(callbackResponse.status, 404)
})
