import { afterEach, describe, expect, test } from 'bun:test'

process.env.HANASAND_SCANNER_URL = 'http://scanner.internal:18200'
process.env.HANASAND_SCANNER_SERVICE_TOKEN = 'test-service-token'
const originalFetch = globalThis.fetch
const { cancelNetworkScannerRun, getNetworkScannerEngines, startNetworkScannerRun, getTenableIntegration, setTenableIntegration, getTenableScans, startTenableRun } = await import('../src/utils/vulnerabilities/scanner.ts')
afterEach(() => { globalThis.fetch = originalFetch })

describe('network scanner service client', () => {
    test('sends the service token and reads engine metadata', async() => {
        let requestHeaders: Headers | undefined
        globalThis.fetch = (async(_input, init) => {
            requestHeaders = new Headers(init?.headers)
            return Response.json({ engines: [{ id: 'nmap', status: 'available', profiles: [{ id: 'tcp-top-100', safe: true }] }] })
        }) as typeof fetch

        const result = await getNetworkScannerEngines()
        expect(requestHeaders?.get('x-hanasand-service-token')).toBe('test-service-token')
        expect(result.engines[0]?.id).toBe('nmap')
    })

    test('submits a fixed scan request and reads its persisted result', async() => {
        const calls: Array<{ url: string, method: string, body?: string }> = []
        const runId = '312a46ba-ec33-48c0-8bac-b274f34fa7f4'
        globalThis.fetch = (async(input, init) => {
            calls.push({ url: String(input), method: init?.method || 'GET', body: typeof init?.body === 'string' ? init.body : undefined })
            if (String(input).endsWith('/v1/network/runs')) return Response.json({ runId, status: 'queued' }, { status: 202 })
            return Response.json({ runId, organizationId: 'org', assetId: 'asset', requestId: 'request', target: 'example.com', addresses: ['8.8.8.8'], profile: 'tcp-top-100', status: 'queued', hosts: [], createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, engineVersion: null, rawXmlSha256: null, error: null })
        }) as typeof fetch
        const request = { organizationId: 'org', assetId: 'asset', requestId: '7114929c-2376-42e4-a25c-0ff1fbb330ca', target: 'example.com', addresses: ['8.8.8.8'], profile: 'tcp-top-100' as const }

        const run = await startNetworkScannerRun(request)
        const submitted = JSON.parse(calls[0]!.body!)
        expect(calls[0]!.method).toBe('POST')
        expect(submitted).toEqual(request)
        expect(calls[1]!.url).toContain(`?organizationId=${encodeURIComponent(request.organizationId)}`)
        expect(run.runId).toBe(runId)
    })

    test('cancels a queued run with organization scope and refreshes its state', async() => {
        const calls: string[] = []
        const runId = '312a46ba-ec33-48c0-8bac-b274f34fa7f4'
        globalThis.fetch = (async(input, init) => {
            calls.push(`${init?.method || 'GET'} ${String(input)}`)
            if ((init?.method || 'GET') === 'POST') return Response.json({ runId, status: 'cancelled', cancelled: true })
            return Response.json({ runId, status: 'cancelled', hosts: [], addresses: [], createdAt: new Date().toISOString() })
        }) as typeof fetch
        await cancelNetworkScannerRun(runId, 'org')
        expect(calls[0]).toContain('POST http://scanner.internal:18200/v1/network/runs/')
        expect(calls[0]).toContain('?organizationId=org')
        expect(calls[1]).toContain('?organizationId=org')
    })
})

describe('Tenable VM service client', () => {
    test('keeps integration credentials on the authenticated server-to-server request and scopes by organization', async() => {
        const calls: Array<{ url: string, method: string, body?: string, token: string | null }> = []
        globalThis.fetch = (async(input, init) => {
            calls.push({ url: String(input), method: init?.method || 'GET', body: typeof init?.body === 'string' ? init.body : undefined, token: new Headers(init?.headers).get('x-hanasand-service-token') })
            return Response.json({ provider: 'tenable-vm', configured: true, credentialStoreAvailable: true, region: 'eu', accessKeyHint: 'abcd', testedAt: null, updatedAt: null, error: null })
        }) as typeof fetch

        await setTenableIntegration('org-1', { region: 'eu', accessKey: 'access-key', secretKey: 'secret-key' })
        await getTenableIntegration('org-1')
        expect(calls[0]?.url).toContain('?organizationId=org-1')
        expect(JSON.parse(calls[0]?.body || '{}')).toEqual({ region: 'eu', accessKey: 'access-key', secretKey: 'secret-key' })
        expect(calls[0]?.token).toBe('test-service-token')
        expect(calls[1]?.url).toContain('?organizationId=org-1')
    })

    test('loads Tenable scan templates for the selected organization', async() => {
        let requestedUrl = ''
        globalThis.fetch = (async(input) => {
            requestedUrl = String(input)
            return Response.json({ scans: [{ id: 'scan-1', name: 'External perimeter', enabled: true }] })
        }) as typeof fetch
        const result = await getTenableScans('org-1')
        expect(requestedUrl).toContain('/v1/integrations/tenable/scans?organizationId=org-1')
        expect(result.scans[0]?.id).toBe('scan-1')
    })

    test('starts Tenable with only the explicitly authorized address list', async() => {
        const calls: Array<{ url: string, method: string, body?: string }> = []
        const runId = '8f47e2d1-7382-4623-baf7-8fe7a0b3af29'
        globalThis.fetch = (async(input, init) => {
            calls.push({ url: String(input), method: init?.method || 'GET', body: typeof init?.body === 'string' ? init.body : undefined })
            if (String(input).endsWith('/v1/integrations/tenable/runs')) return Response.json({ runId, status: 'queued' }, { status: 202 })
            return Response.json({ runId, organizationId: 'org-1', assetId: 'asset-1', requestId: 'request-1', target: 'example.com', addresses: ['8.8.8.8'], scanId: '1001', status: 'queued', findings: [], createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, error: null })
        }) as typeof fetch
        const request = { organizationId: 'org-1', assetId: 'asset-1', requestId: '7114929c-2376-42e4-a25c-0ff1fbb330ca', target: 'example.com', addresses: ['8.8.8.8'], scanId: '1001' }
        const result = await startTenableRun(request)
        expect(calls[0]?.method).toBe('POST')
        expect(JSON.parse(calls[0]?.body || '{}')).toEqual(request)
        expect(calls[1]?.url).toContain(`/v1/integrations/tenable/runs/${runId}?organizationId=org-1`)
        expect(result.runId).toBe(runId)
    })
})
