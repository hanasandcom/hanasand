import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { test } from 'node:test'
import { presentedApiKey, proxyApiTiRequest, proxyTiRequest, resolveDwmRequestScope, withDwmRequestScope } from '../src/app/api/findings/_tiProxy'

test('API key and session requests preserve the TI proxy auth contract', async () => {
    const previousFetch = globalThis.fetch
    const previousApiUrl = process.env.FRONTEND_INTERNAL_API
    process.env.FRONTEND_INTERNAL_API = 'https://auth.example/api'

    const requests: Request[] = []
    globalThis.fetch = async (input, init) => {
        requests.push(new Request(input, init))
        return new Response('{"result":"ok"}', {
            status: 207,
            headers: {
                'content-type': 'application/json',
                'retry-after': '4',
                'x-api-key-rate-limit-remaining': '8',
                'x-private-header': 'not-forwarded',
            },
        })
    }

    try {
        const scope = resolveDwmRequestScope({
            identityId: 'user-1',
            params: new URLSearchParams('organizationId=org-1'),
            headers: new Headers({ 'x-organization-id': 'org-1' }),
        })
        assert.deepEqual(scope, { tenantId: 'org-1', organizationId: 'org-1' })
        assert.deepEqual(withDwmRequestScope({ items: [{ tenantId: 'spoofed', organizationId: 'spoofed', value: 'evidence' }] }, scope), {
            tenantId: 'org-1',
            organizationId: 'org-1',
            orgId: 'org-1',
            items: [{ tenantId: 'org-1', organizationId: 'org-1', orgId: 'org-1', value: 'evidence' }],
        })

        const apiKeyRequest = new NextRequest('https://app.example/api/ti/search', {
            method: 'POST',
            headers: { 'x-api-key': '  hsk_fixture  ', 'content-type': 'application/json' },
            body: '{"query":"actor"}',
        })
        assert.equal(presentedApiKey(apiKeyRequest), 'hsk_fixture')
        assert.equal(presentedApiKey(new NextRequest('https://app.example/api/ti/search', {
            headers: { authorization: 'Bearer hsk_bearer' },
        })), 'hsk_bearer')
        assert.equal(presentedApiKey(new NextRequest('https://app.example/api/ti/search', {
            headers: { authorization: 'Bearer session-token' },
        })), '')

        const apiKeyResponse = await proxyApiTiRequest(apiKeyRequest, '/ti/search', { method: 'POST' })
        assert.equal(apiKeyResponse.status, 207)
        assert.deepEqual(await apiKeyResponse.json(), { result: 'ok' })
        assert.equal(apiKeyResponse.headers.get('retry-after'), '4')
        assert.equal(apiKeyResponse.headers.get('x-api-key-rate-limit-remaining'), '8')
        assert.equal(apiKeyResponse.headers.get('x-private-header'), null)
        assert.equal(requests[0]?.url, 'https://auth.example/api/ti/search')
        assert.equal(requests[0]?.headers.get('x-api-key'), 'hsk_fixture')
        assert.equal(await requests[0]?.text(), '{"query":"actor"}')

        const beforeUnauthorized = requests.length
        const unauthenticated = new NextRequest('https://app.example/api/ti/search')
        const unauthorizedResponse = await proxyApiTiRequest(unauthenticated, '/ti/search')
        assert.equal(unauthorizedResponse.status, 401)
        assert.equal(requests.length, beforeUnauthorized)

        const scraperUnauthenticated = await proxyTiRequest(unauthenticated, '/v1/dwm/product', { method: 'GET' })
        assert.equal(scraperUnauthenticated.status, 401)
        assert.equal(requests.length, beforeUnauthorized)
    } finally {
        globalThis.fetch = previousFetch
        if (previousApiUrl === undefined) delete process.env.FRONTEND_INTERNAL_API
        else process.env.FRONTEND_INTERNAL_API = previousApiUrl
    }

})
