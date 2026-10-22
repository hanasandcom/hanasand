import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { callback, start } from '../src/app/api/auth/social/proxy'

const realFetch = globalThis.fetch
let called = 0
let responseData: Record<string, unknown> = {}
let responseStatus = 200
let upstreamBody: Record<string, unknown> = {}
globalThis.fetch = (async (_url, options) => {
    called++
    upstreamBody = JSON.parse(String(options?.body))
    return Response.json(responseData, {
        status: responseStatus,
        headers: responseData.url ? { 'set-cookie': `hanasand_auth_binding=${binding}; Domain=.hanasand.com; Secure; HttpOnly; SameSite=None; Path=/; Max-Age=600` } : undefined,
    })
}) as typeof fetch
const origin = 'https://hanasand.com'
const binding = 'A'.repeat(43)
try {
    responseData = { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' }
    const login = await start(new NextRequest(`${origin}/api/auth/social/google/start?redirectPath=/thesis`), 'google')
    assert.equal(login.status, 303)
    assert.equal(upstreamBody.link, false)
    assert.equal(upstreamBody.redirectPath, '/thesis')
    const cookie = login.cookies.get('hanasand_auth_binding')!
    assert.equal(cookie.value, binding)
    assert.match(cookie.value, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(cookie.domain, '.hanasand.com')
    const header = login.headers.get('set-cookie')!
    for (const setting of ['Secure', 'HttpOnly', 'SameSite=none', 'Path=/', 'Domain=.hanasand.com']) assert.ok(header.includes(setting))
    const before = called
    assert.equal((await start(new NextRequest(`${origin}/api/auth/social/google/start`, { method: 'POST', headers: { origin: 'https://attacker.test' } }), 'google')).status, 403)
    assert.equal((await start(new NextRequest(`${origin}/api/auth/social/google/start`, { method: 'POST', headers: { origin, cookie: 'impersonation_token=active' } }), 'google')).status, 403)
    assert.equal(called, before)
    await start(new NextRequest(`${origin}/api/auth/social/google/start`, { method: 'POST', headers: { origin, cookie: 'access_token=session; id=owner' } }), 'google')
    assert.equal(upstreamBody.link, true)
    responseData = { url: 'https://attacker.test' }
    assert.ok((await start(new NextRequest(`${origin}/api/auth/social/google/start`), 'google')).headers.get('location')!.startsWith(`${origin}/login?`))
    responseData = { id: 'owner', token: 'verified-session', redirectPath: '//attacker.test' }
    const apple = await callback(new NextRequest(`${origin}/api/auth/social/apple/callback`, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: `hanasand_auth_binding=${binding}` },
        body: new URLSearchParams({ code: 'apple-code', state: 'apple-state' }),
    }), 'apple')
    assert.equal(upstreamBody.code, 'apple-code')
    assert.equal(upstreamBody.binding, binding)
    assert.equal(apple.status, 200)
    const browserHandoff = await apple.text()
    assert.ok(browserHandoff.includes(`window.location.replace("${origin}/dashboard")`))
    assert.ok(browserHandoff.includes('await device.sync()'))
    assert.ok(!browserHandoff.includes('verified-session'))
    assert.ok(apple.headers.get('set-cookie')!.includes('access_token=verified-session'))
    assert.equal(apple.cookies.get('hanasand_auth_binding')?.maxAge, 0)
    responseData = { linked: true, redirectPath: '/profile?social=linked' }
    const linked = await callback(new NextRequest(`${origin}/api/auth/social/google/callback?code=a&state=b`), 'google')
    assert.equal(linked.cookies.get('access_token'), undefined)
    assert.equal(linked.headers.get('location'), `${origin}/profile?social=linked`)
    responseStatus = 400; responseData = { error: 'Sign-in was cancelled.' }
    const cancelled = await callback(new NextRequest(`${origin}/api/auth/social/google/callback?error=access_denied&state=b`), 'google')
    assert.equal(upstreamBody.cancelled, true)
    assert.ok(cancelled.headers.get('location')!.includes('socialError='))
    assert.equal(cancelled.cookies.get('access_token'), undefined)
} finally { globalThis.fetch = realFetch }
console.log('Social frontend proxy: Identity-owned shared secure binding, same-origin linking, impersonation block, Apple form POST, session cookies, safe redirects, linking without session switching, cancellation passed.')
