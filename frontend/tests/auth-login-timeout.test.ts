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

globalThis.fetch = originalFetch
console.log('Login timeout is bounded and returned as a visible 504 instead of a pending request.')
