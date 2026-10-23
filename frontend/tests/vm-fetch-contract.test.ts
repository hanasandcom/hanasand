import assert from 'node:assert/strict'
// @ts-expect-error Bun provides the mocking module for focused tests.
import { mock, test } from 'bun:test'
import config from '../src/config'

type CapturedRequest = { input: string | URL | Request, init?: RequestInit & { timeoutMs?: number, retries?: number } }

const requests: CapturedRequest[] = []
let response = Response.json({})
let failure: Error | null = null

mock.module('@/utils/fetchWithRetry', () => ({
    default: async (input: CapturedRequest['input'], init?: CapturedRequest['init']) => {
        requests.push({ input, init })
        if (failure) throw failure
        return response.clone()
    },
}))

const { default: getVMConnection } = await import('../src/utils/vms/fetch/getVMConnection')
const { default: getVMMetrics } = await import('../src/utils/vms/fetch/metrics/getVMMetrics')
const { default: getLatestVMMetrics } = await import('../src/utils/vms/fetch/metrics/getLatestVMMetrics')

test('VM connection and metrics share the authenticated retry request contract', async () => {
    requests.length = 0
    const connection = { host: 'vm.example.test', port: 2200 }
    response = Response.json(connection)
    assert.deepEqual(await getVMConnection('vm/a', 'token-1', 'user-1'), connection)

    const metrics = [{ cpu: 12, recordedAt: '2026-10-17T10:00:00Z' }]
    response = Response.json(metrics)
    assert.deepEqual(await getVMMetrics('vm b', 'token-2', 'user-2'), metrics)

    assert.deepEqual(requests.map(({ input }) => String(input)), [
        `${config.url.api}/vm/vm%2Fa/connection`,
        `${config.url.api}/vm/metrics/vm%20b`,
    ])
    assert.deepEqual(requests.map(({ init }) => init), [
        { headers: { Authorization: 'Bearer token-1', id: 'user-1' }, timeoutMs: config.abortTimeout, retries: 2 },
        { headers: { Authorization: 'Bearer token-2', id: 'user-2' }, timeoutMs: config.abortTimeout, retries: 2 },
    ])
})

test('browser latest VM metrics rely on the same-origin HttpOnly session cookie', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const originalFetch = globalThis.fetch
    const metrics = [{ name: 'vm-1', disk_total_mb: 40960, created_at: '2026-10-23T10:00:00Z' }]
    let request: { url: string, credentials?: RequestCredentials, cache?: RequestCache, headers: Headers } | undefined

    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'id=user-3' } })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        request = { url: String(input), credentials: init?.credentials, cache: init?.cache, headers: new Headers(init?.headers) }
        return Response.json(metrics)
    }) as typeof fetch

    try {
        assert.deepEqual(await getLatestVMMetrics(), metrics)
        assert.equal(request?.url, '/api/backend/vm/metrics')
        assert.equal(request?.credentials, 'same-origin')
        assert.equal(request?.cache, 'no-store')
        assert.equal(request?.headers.has('authorization'), false)
        assert.equal(request?.headers.has('id'), false)
        assert.equal(document.cookie.includes('access_token'), false, 'the HttpOnly access token is unavailable to JavaScript')
    } finally {
        globalThis.fetch = originalFetch
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
        else Reflect.deleteProperty(globalThis, 'window')
        if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})

test('VM connection logs response text and retains its null fallback on HTTP errors', async () => {
    const logs: unknown[][] = []
    const originalLog = console.log
    console.log = (...values: unknown[]) => logs.push(values)
    response = new Response('connection denied', { status: 403 })
    failure = null
    try {
        assert.equal(await getVMConnection('vm-1', 'token', 'user'), null)
        assert.equal((logs[0]?.[0] as Error).message, 'connection denied')
    } finally {
        console.log = originalLog
    }
})

test('VM metrics logs response text and retains its empty-array fallback on HTTP errors', async () => {
    const logs: unknown[][] = []
    const originalLog = console.log
    console.log = (...values: unknown[]) => logs.push(values)
    response = new Response('metrics unavailable', { status: 503 })
    failure = null
    try {
        assert.deepEqual(await getVMMetrics('vm-1', 'token', 'user'), [])
        assert.equal((logs[0]?.[0] as Error).message, 'metrics unavailable')
    } finally {
        console.log = originalLog
    }
})
