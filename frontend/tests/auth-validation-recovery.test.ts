import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { mock } from 'bun:test'
import { NextRequest } from 'next/server'
import { decodeInternalHeaderValue, encodeInternalHeaderValue } from '../src/utils/proxy/internalHeaderValue'

let fetchResult: Response | Error = new Error('timeout')
let sequence = 0
mock.module('@/utils/fetchWithRetry', () => ({ default: async () => {
    if (fetchResult instanceof Error) throw fetchResult
    return fetchResult.clone()
} }))
const { default: tokenIsValid, tokenValidationState } = await import('../src/utils/proxy/tokenIsValid')
const { proxy } = await import('../src/proxy')
const { default: requireApiSession } = await import('../src/utils/proxy/requireApiSession')

for (const value of ['Sindre Hagen Strømdal', 'Zoë Østby', '雪だるま ☃️', '']) {
    const encoded = encodeInternalHeaderValue(value)
    assert.match(encoded, /^[\x20-\x7e]*$/, 'Internal header values stay ASCII')
    assert.equal(decodeInternalHeaderValue(encoded), value, 'Internal header values round-trip as UTF-8')
}
assert.equal(decodeInternalHeaderValue('utf8b64._w'), undefined, 'Malformed UTF-8 header values fail closed')

async function validate(result: Response | Error, token = `test-${sequence++}`) {
    fetchResult = result
    return tokenIsValid(token, 'user')
}
function request(cookies: string, method = 'GET') {
    return new NextRequest('https://app.example/content/thesis?view=history', { method, headers: { cookie: cookies } })
}
assert.equal((await validate(new Error('timeout'))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 503 }))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 504 }))).state, 'unavailable')
assert.equal((await validate(new Response('', { status: 401 }))).state, 'invalid')
assert.equal((await validate(new Response('', { status: 403 }))).state, 'invalid')
assert.equal(tokenValidationState(400), 'unavailable')
assert.equal((await validate(new Error('temporary outage'), 'recovering-session')).state, 'unavailable')
assert.equal((await validate(Response.json({}), 'recovering-session')).state, 'valid', 'An outage must not remain cached after authentication recovers')

const sessionExpiresAt = new Date(Date.now() + 30 * 60_000).toISOString()
const authCheckedAt = new Date(Date.now() - 2 * 60_000).toISOString()
fetchResult = new Error('network unavailable')
const degraded = await proxy(request(`access_token=grace; id=user; session_expires_at=${encodeURIComponent(sessionExpiresAt)}; auth_checked_at=${encodeURIComponent(authCheckedAt)}`))
assert.equal(degraded.status, 503, 'Client-provided freshness cookies must never authorize an unavailable session')
assert.equal(degraded.headers.get('x-middleware-next'), null)

const unavailable = await proxy(request('access_token=outage; id=user'))
assert.equal(unavailable.status, 503)
assert.equal(unavailable.headers.get('set-cookie'), null)
assert.equal(unavailable.headers.get('x-middleware-next'), null, 'Unverified requests cannot reach protected content')
assert.equal(unavailable.headers.get('cache-control'), 'no-store')
assert.equal(unavailable.headers.get('retry-after'), '3')
assert.match(unavailable.headers.get('content-type') || '', /text\/html/)
const html = await unavailable.text()
assert.match(html, /<title>Reconnecting<\/title>/)
assert.match(html, /http-equiv="refresh" content="3"/)
assert(!html.includes('hanasand-logo-transparent.png'), 'The auth recovery fallback stays free of branding.')
assert.match(html, /href="\/content\/thesis\?view=history"/)
assert(!html.includes('authentication_service_unavailable'))
const clientNavigation = await proxy(new NextRequest('https://app.example/content/thesis', { headers: { cookie: 'access_token=outage; id=user', rsc: '1' } }))
assert.match(clientNavigation.headers.get('content-type') || '', /text\/html/)
const mutation = await proxy(request('access_token=outage; id=user', 'POST'))
assert.equal(mutation.status, 503)
assert.match(mutation.headers.get('content-type') || '', /application\/json/)
const api = await requireApiSession(new NextRequest('https://app.example/api/findings/watchlists', { headers: { cookie: 'access_token=outage; id=user' } }))
assert('response' in api)
assert.equal(api.response.status, 503)
assert.match(api.response.headers.get('content-type') || '', /application\/json/)

fetchResult = new Response('', { status: 401 })
const unauthorized = await proxy(request(`access_token=revoked; id=user; session_expires_at=${encodeURIComponent(sessionExpiresAt)}; auth_checked_at=${encodeURIComponent(authCheckedAt)}`))
assert.equal(unauthorized.status, 307)
assert.match(unauthorized.headers.get('location') || '', /\/login\?/)
assert.match(unauthorized.headers.get('set-cookie') || '', /access_token=/)
fetchResult = new Response('', { status: 403 })
const forbidden = await proxy(request('access_token=forbidden; id=user'))
assert.equal(forbidden.status, 307)
assert.match(forbidden.headers.get('set-cookie') || '', /session_expires_at=/)

const displayName = 'Sindre Hagen Strømdal'
const avatar = 'https://cdn.example/雪.png'
fetchResult = Response.json({ name: displayName, avatar, expires_at: sessionExpiresAt })
const unicodeSession = await proxy(new NextRequest('https://app.example/dashboard', {
    headers: {
        cookie: `access_token=unicode-session; id=user; impersonation_token=impersonation%3Atarget; impersonating_id=target; impersonating_name=${encodeURIComponent(displayName)}`,
        'x-impersonating-name': 'untrusted incoming value',
    },
}))
assert.equal(unicodeSession.status, 200)
assert.equal(decodeInternalHeaderValue(unicodeSession.headers.get('x-middleware-request-x-hanasand-session-id')), 'user')
assert.equal(decodeInternalHeaderValue(unicodeSession.headers.get('x-middleware-request-x-hanasand-session-name')), displayName)
assert.equal(decodeInternalHeaderValue(unicodeSession.headers.get('x-middleware-request-x-hanasand-session-avatar')), avatar)
assert.equal(decodeInternalHeaderValue(unicodeSession.headers.get('x-middleware-request-x-impersonating-id')), 'target')
assert.equal(decodeInternalHeaderValue(unicodeSession.headers.get('x-middleware-request-x-impersonating-name')), displayName)
assert.match(unicodeSession.headers.get('x-middleware-override-headers') || '', /x-hanasand-session-name/)

const spoofedInternalHeader = await proxy(new NextRequest('https://app.example/about', {
    headers: { 'x-impersonating-name': 'spoofed', 'x-impersonating-id': 'spoofed', 'x-auth-state': 'caller-controlled' },
}))
assert(!/x-impersonating-(?:name|id)/.test(spoofedInternalHeader.headers.get('x-middleware-override-headers') || ''),
    'Caller-provided impersonation headers are discarded')
assert.equal(spoofedInternalHeader.headers.get('x-auth-state'), null, 'Caller-provided auth-state is not reflected in a response header')

const originalFetch = globalThis.fetch
const originalNow = Date.now
let testNow = originalNow()
let serviceValidationCalls = 0
let serviceValidationStatus = 200
globalThis.fetch = async () => {
    serviceValidationCalls += 1
    return Response.json({ id: 'svc-db-monitor', pages: ['/db'] }, { status: serviceValidationStatus })
}
Date.now = () => testNow
try {
    const [serviceAccount, concurrentServiceAccount] = await Promise.all([
        tokenIsValid('hsk_test_service_key', 'svc-db-monitor'),
        tokenIsValid('hsk_test_service_key', 'svc-db-monitor'),
    ])
    assert.equal(serviceAccount.valid, true)
    assert.deepEqual(serviceAccount.servicePages, ['/db'])
    assert.deepEqual(concurrentServiceAccount.servicePages, ['/db'])
    assert.equal(serviceValidationCalls, 1, 'Concurrent requests should share one live service-scope lookup')

    serviceValidationStatus = 403
    const cachedServiceAccount = await tokenIsValid('hsk_test_service_key', 'svc-db-monitor')
    assert.equal(cachedServiceAccount.valid, true, 'The short cache avoids repeating the service scope query on every navigation')
    assert.equal(serviceValidationCalls, 1)

    testNow += 5_001
    const revokedServiceAccount = await tokenIsValid('hsk_test_service_key', 'svc-db-monitor')
    assert.equal(revokedServiceAccount.state, 'invalid', 'Revoked service scopes are rechecked after the same five-second window used for human sessions')
    assert.equal(serviceValidationCalls, 2)
} finally {
    globalThis.fetch = originalFetch
    Date.now = originalNow
}
console.log('Auth recovery passed: immediate revalidation, HTML page fallback, preserved cookies, API errors and revoked-session rejection.')
