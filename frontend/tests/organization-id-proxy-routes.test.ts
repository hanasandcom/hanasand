import assert from 'node:assert/strict'
import { afterAll, afterEach, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

const originalFetch = globalThis.fetch
const originalTimeout = AbortSignal.timeout
const originalApi = process.env.FRONTEND_AUTH_API
const timeoutValues: number[] = []

process.env.FRONTEND_AUTH_API = 'https://organization-api.test/api'
mock.module('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

afterEach(() => {
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
    timeoutValues.length = 0
})
afterAll(() => {
    if (originalApi === undefined) delete process.env.FRONTEND_AUTH_API
    else process.env.FRONTEND_AUTH_API = originalApi
})

test('organization ID proxy routes preserve methods, encoded params, and query forwarding', async () => {
    const calls: Array<{ url: URL, method: string | undefined }> = []
    globalThis.fetch = (async (input, init) => {
        calls.push({ url: new URL(String(input)), method: init?.method })
        return Response.json({ ok: true })
    }) as typeof fetch
    AbortSignal.timeout = ((milliseconds: number) => {
        timeoutValues.push(milliseconds)
        return originalTimeout(milliseconds)
    }) as typeof AbortSignal.timeout

    const cases = [
        { route: await import('../src/app/api/organizations/[id]/route'), method: 'GET', params: { id: 'org/a' }, path: '/organizations/org%2Fa' },
        { route: await import('../src/app/api/organizations/[id]/alert-case-visibility/route'), method: 'GET', params: { id: 'org/a' }, path: '/organizations/org%2Fa/alert-case-visibility' },
        { route: await import('../src/app/api/organizations/[id]/api-keys/route'), method: 'GET', params: { id: 'org/a' }, path: '/organizations/org%2Fa/api-keys' },
        { route: await import('../src/app/api/organizations/[id]/api-keys/route'), method: 'POST', params: { id: 'org/a' }, path: '/organizations/org%2Fa/api-keys' },
        { route: await import('../src/app/api/organizations/[id]/api-keys/[keyId]/route'), method: 'DELETE', params: { id: 'org/a', keyId: 'key/1' }, path: '/organizations/org%2Fa/api-keys/key%2F1' },
        { route: await import('../src/app/api/organizations/[id]/invites/route'), method: 'GET', params: { id: 'org/a' }, path: '/organizations/org%2Fa/invites' },
        { route: await import('../src/app/api/organizations/[id]/invites/route'), method: 'POST', params: { id: 'org/a' }, path: '/organizations/org%2Fa/invites' },
        { route: await import('../src/app/api/organizations/[id]/invites/[inviteId]/actions/route'), method: 'POST', params: { id: 'org/a', inviteId: 'invite/1' }, path: '/organizations/org%2Fa/invites/invite%2F1/actions' },
        { route: await import('../src/app/api/organizations/[id]/members/route'), method: 'GET', params: { id: 'org/a' }, path: '/organizations/org%2Fa/members' },
        { route: await import('../src/app/api/organizations/[id]/members/[userId]/route'), method: 'DELETE', params: { id: 'org/a', userId: 'user/1' }, path: '/organizations/org%2Fa/members/user%2F1' },
        { route: await import('../src/app/api/organizations/[id]/members/[userId]/role/route'), method: 'PATCH', params: { id: 'org/a', userId: 'user/1' }, path: '/organizations/org%2Fa/members/user%2F1/role' },
        { route: await import('../src/app/api/organizations/[id]/privacy/route'), method: 'GET', params: { id: 'org/a' }, path: '/organizations/org%2Fa/privacy', timeoutMs: 30000 },
        { route: await import('../src/app/api/organizations/[id]/privacy/route'), method: 'POST', params: { id: 'org/a' }, path: '/organizations/org%2Fa/privacy', timeoutMs: 60000 },
        { route: await import('../src/app/api/organizations/[id]/settings/route'), method: 'GET', params: { id: 'org/a' }, path: '/organizations/org%2Fa/settings' },
        { route: await import('../src/app/api/organizations/[id]/settings/route'), method: 'PUT', params: { id: 'org/a' }, path: '/organizations/org%2Fa/settings' },
    ]

    for (const [index, item] of cases.entries()) {
        const handler = item.route[item.method]
        const request = new NextRequest(`https://frontend.test/api/organizations/org?case=${index}`, {
            method: item.method,
            body: item.method === 'GET' ? undefined : '{}',
        })
        const response = await handler(request, { params: Promise.resolve(item.params) })
        assert.equal(response.status, 200)
        assert.equal(calls[index]?.url.origin, 'https://organization-api.test')
        assert.equal(calls[index]?.url.pathname, `/api${item.path}`)
        assert.equal(calls[index]?.url.searchParams.get('case'), String(index))
        assert.equal(calls[index]?.method, item.method)
        assert.equal(timeoutValues[index], item.timeoutMs || 12000)
    }
})
