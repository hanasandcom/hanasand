// @ts-expect-error Bun exposes module mocking to tests.
import { afterEach, expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

let validations = 0
let scopeValidations = 0
mock.module('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
mock.module('@/utils/organizations/serverWorkspace', () => ({ activeOrganizationId: async () => undefined }))
mock.module('@/utils/dwm/scraperApiBase', () => ({ tiScraperApiBase: () => 'http://synthetic-scraper/' }))
mock.module('@/utils/proxy/requireApiSession', () => ({ default: async () => {
    validations++
    return { response: new Response('{}', { status: 401 }) }
} }))
mock.module('../src/app/api/findings/verifyDwmOrganizationScope', () => ({ verifyDwmOrganizationScope: async () => { scopeValidations++ } }))
const { caseReadProof } = await import('../src/app/api/cases/caseReadProof')
const { proxyTiRequest } = await import('../src/app/api/findings/_tiProxy')
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch; validations = 0; scopeValidations = 0 })

function request(headers: Record<string, string> = {}, query = 'collection=intelligence', method = 'GET') {
    return new NextRequest(`http://localhost:3000/api/cases?${query}`, { method, headers: {
        authorization: 'Bearer synthetic-session', id: 'synthetic-user', DPoP: 'synthetic-proof',
        'x-device-proof-url': 'https://hanasand.com/api/cases', 'x-device-proof-method': method, ...headers,
    } })
}

test('forwards one native proof and exact selected organization to the sole downstream authorizer', async () => {
    const requests: Request[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init))
        return Response.json({ items: [] })
    }) as typeof fetch
    const response = await proxyTiRequest(request({ 'x-organization-id': 'synthetic-customer', 'x-actor-id': 'spoofed' }, 'collection=intelligence&organizationId=synthetic-customer&tenantId=spoofed'), '/v1/cases')
    expect(response.status).toBe(200)
    expect(validations).toBe(0)
    expect(scopeValidations).toBe(0)
    expect(requests).toHaveLength(1)
    const sent = requests[0]
    expect(sent.headers.get('authorization')).toBe('Bearer synthetic-session')
    expect(sent.headers.get('dpop')).toBe('synthetic-proof')
    expect(sent.headers.get('x-device-proof-url')).toBe('https://hanasand.com/api/cases')
    expect(sent.headers.get('x-device-proof-method')).toBe('GET')
    expect(sent.headers.get('x-actor-id')).toBe('synthetic-user')
    expect(new URL(sent.url).searchParams.get('tenantId')).toBe('synthetic-customer')
    expect(sent.headers.get('x-organization-id')).toBe('synthetic-customer')
})

test('personal reads replace any supplied tenant with the authenticated identity', async () => {
    let sent: Request | undefined
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        sent = new Request(input, init)
        return Response.json({ items: [] })
    }) as typeof fetch
    expect((await proxyTiRequest(request({}, 'collection=intelligence&tenantId=another-user'), '/v1/cases')).status).toBe(200)
    expect(new URL(sent!.url).searchParams.get('tenantId')).toBe('synthetic-user')
    expect(sent!.headers.has('x-organization-id')).toBe(false)
})

test('rejects conflicting organization scope without calling a service', async () => {
    globalThis.fetch = (() => { throw new Error('Unexpected service request') }) as typeof fetch
    expect((await proxyTiRequest(request({ 'x-organization-id': 'customer-a' }, 'collection=intelligence&organizationId=customer-b'), '/v1/cases')).status).toBe(400)
})

test('only the explicit intelligence GET delegates authorization', async () => {
    expect((await proxyTiRequest(request({}, 'collection=monitoring'), '/v1/cases')).status).toBe(401)
    expect((await proxyTiRequest(request({}, ''), '/v1/cases')).status).toBe(401)
    expect((await proxyTiRequest(request({}, 'collection=intelligence', 'POST'), '/v1/cases')).status).toBe(401)
    expect((await proxyTiRequest(request(), '/v1/cases', { method: 'POST' })).status).toBe(401)
    expect(validations).toBe(4)
})

test('rejects mismatched target, method and unsupported impersonation before forwarding', () => {
    for (const headers of [
        { 'x-device-proof-url': 'https://attacker.test/api/cases' },
        { 'x-device-proof-url': 'https://hanasand.com/api/cases/unrelated' },
        { 'x-device-proof-method': 'POST' },
        { 'x-impersonation-token': 'synthetic-target' },
    ]) {
        const result = caseReadProof(request(headers))
        expect('response' in result && result.response.status).toBe(401)
    }
})
