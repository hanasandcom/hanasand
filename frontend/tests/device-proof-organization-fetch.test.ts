import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createDeviceProofHeaders } from '../src/utils/auth/deviceProof'

test('organization list proof headers bind the browser-facing GET target', async () => {
    const originalWindow = globalThis.window
    globalThis.window = {
        hanasandDeviceProofReady: Promise.resolve({
            publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
            create: async (_token: string, method: string, url: string) => ({ proof: 'signed-proof', publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, url: new URL(url).href }),
            sync: async () => {},
        }),
    } as Window & typeof globalThis
    try {
        const headers = await createDeviceProofHeaders('session-token', 'GET', 'https://stage.example.test/api/organizations')
        assert.deepEqual(headers, {
            DPoP: 'signed-proof',
            'x-device-proof-method': 'GET',
            'x-device-proof-url': 'https://stage.example.test/api/organizations',
        })
    } finally {
        globalThis.window = originalWindow
    }
})

test('workspace organization fetch sends device proof headers for the exact API URL', async () => {
    const source = await readFile(new URL('../src/components/organizations/workspaceProvider.tsx', import.meta.url), 'utf8')
    assert.match(source, /createDeviceProofHeaders\(token, 'GET', new URL\('\/api\/organizations', window\.location\.origin\)\.href\)/)
    assert.match(source, /fetch\('\/api\/organizations', \{ headers: proofHeaders/)
})

test('organization API proxy forwards the browser proof and its signed request target', async () => {
    const source = await readFile(new URL('../src/app/api/organizations/_organizationApiProxy.ts', import.meta.url), 'utf8')
    assert.match(source, /request\.headers\.get\('dpop'\)/)
    assert.match(source, /!options\.verifiedWatchlistSession && request\.headers\.get\('dpop'\)/)
    assert.match(source, /'x-device-proof-url': request\.headers\.get\('x-device-proof-url'\) \|\| request\.url/)
    assert.match(source, /'x-device-proof-method': request\.headers\.get\('x-device-proof-method'\) \|\| request\.method/)
    assert.match(source, /\.\.\.browserDeviceProof/)
})
