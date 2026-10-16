import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

process.env.VM_API_TOKEN = ''
process.env.FRONTEND_INTERNAL_API = 'https://auth.example/api'

const originalFetch = globalThis.fetch
const timeoutError = Object.assign(new Error('upstream timeout'), { name: 'TimeoutError' })
const { POST } = await import('../src/app/api/auth/login/route')

globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), 'https://auth.example/api/auth/login/alice')
    assert.ok(init?.signal instanceof AbortSignal, 'Login requests must have an upstream deadline.')
    throw timeoutError
}) as typeof fetch

const formResponse = await POST(new NextRequest('https://app.example/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'alice', password: 'secret', redirectPath: '/rules/tuning' }),
}))
assert.equal(formResponse.status, 303)
const formLocation = new URL(formResponse.headers.get('location') || '', 'https://app.example')
assert.equal(formLocation.pathname, '/login')
assert.equal(formLocation.searchParams.get('path'), '/rules/tuning')
assert.equal(formLocation.searchParams.get('error'), 'Authentication service timed out. Please try again.')

const jsonResponse = await POST(new NextRequest('https://app.example/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'alice', password: 'secret' }),
}))
assert.equal(jsonResponse.status, 504)
assert.deepEqual(await jsonResponse.json(), {
    error: 'Authentication service timed out. Please try again.',
    code: 'auth_service_timeout',
})

let loginRequest: { input: string, init?: RequestInit } | undefined
globalThis.fetch = (async (input, init) => {
    loginRequest = { input: String(input), init }
    return Response.json({
        token: 'session-token',
        id: 'alice-id',
        name: 'Alice',
        avatar: '/avatar.png',
        expires_at: '2030-01-01T00:00:00.000Z',
    })
}) as typeof fetch

const successResponse = await POST(new NextRequest('https://app.example/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': 'request-123' },
    body: JSON.stringify({ id: 'alice', password: 'secret' }),
}))
assert.equal(successResponse.status, 200)
assert.deepEqual(await successResponse.json(), {
    name: 'Alice',
    id: 'alice-id',
    avatar: '/avatar.png',
    expires_at: '2030-01-01T00:00:00.000Z',
})
assert.equal(loginRequest?.input, 'https://auth.example/api/auth/login/alice')
assert.equal(loginRequest?.init?.method, 'POST')
assert.equal(loginRequest?.init?.headers && new Headers(loginRequest.init.headers).get('x-request-id'), 'request-123')
assert.deepEqual(JSON.parse(String(loginRequest?.init?.body)), { password: 'secret' })
assert.match(successResponse.headers.get('set-cookie') || '', /access_token=session-token/)
assert.match(successResponse.headers.get('set-cookie') || '', /name=Alice/)

globalThis.fetch = originalFetch
console.log('Login timeout, redirect, upstream request and successful session cookie contracts passed.')
