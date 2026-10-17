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
