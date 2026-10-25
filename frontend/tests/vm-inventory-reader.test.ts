import assert from 'node:assert/strict'
// @ts-expect-error Bun provides the mocking module for focused tests.
import { mock, test } from 'bun:test'
import config from '../src/config'

type RequestOptions = RequestInit & { timeoutMs?: number, retries?: number }
const requests: { input: string | URL | Request, options?: RequestOptions }[] = []
let responseFactory = () => Response.json([])

mock.module('@/utils/fetchWithRetry', () => ({
    default: async (input: string | URL | Request, options?: RequestOptions) => {
        requests.push({ input, options })
        return responseFactory()
    },
}))

const { default: getVMs } = await import('../src/utils/vms/fetch/getVMs')

test('browser VM inventory requests bypass the HTTP cache across workspace changes', async () => {
    requests.length = 0
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '' } })
    responseFactory = () => Response.json([])

    try {
        assert.deepEqual(await getVMs('user-1'), [])
        assert.equal(String(requests[0]?.input), '/api/backend/vms/user-1')
        assert.equal(requests[0]?.options?.cache, 'no-store')
    } finally {
        if (previousWindow === undefined) delete (globalThis as typeof globalThis & { window?: Window }).window
        else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow })
        if (previousDocument === undefined) delete (globalThis as typeof globalThis & { document?: Document }).document
        else Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument })
    }
})

test('VM inventory uses the authenticated request and cancels a stalled response body', async () => {
    requests.length = 0
    const inventory = [{ id: 'vm-1', status: 'Running' }]
    responseFactory = () => Response.json(inventory)

    assert.deepEqual(await getVMs('organization-one', 'token%20value', 'user-1', 'impersonation', 'cashflow'), inventory)
    assert.equal(String(requests[0]?.input), `${config.url.api}/vms/organization-one`)
    assert.deepEqual(requests[0]?.options, {
        cache: 'no-store',
        headers: {
            Authorization: 'Bearer token value',
            id: 'user-1',
            'x-impersonation-token': 'impersonation',
            'x-organization-id': 'cashflow',
        },
        timeoutMs: config.abortTimeout,
        retries: 2,
    })
    responseFactory = () => Response.json([])
    assert.deepEqual(await getVMs('organization-one', 'token', 'user-1'), [])

    responseFactory = () => Response.json({ error: 'temporarily unavailable' }, { status: 503 })
    assert.equal(await getVMs('organization-one', 'token', 'user-1'), null)

    const previousTimeout = config.abortTimeout
    config.abortTimeout = 20
    let canceled = false
    responseFactory = () => new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('['))
        },
        cancel() {
            canceled = true
        },
    }))

    const startedAt = Date.now()
    try {
        assert.equal(await getVMs('organization-one', 'token', 'user-1'), null)
        assert.equal(canceled, true)
        assert.ok(Date.now() - startedAt < 1000)
    } finally {
        config.abortTimeout = previousTimeout
    }
})
