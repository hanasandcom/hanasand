import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { promisify } from 'node:util'

const requests: Array<{ url: string, init?: RequestInit }> = []
const timeoutCalls: number[] = []
const timeoutSignal = new AbortController().signal
let fetchCalls = 0
const mockExecFile = Object.assign(() => undefined, {
    [promisify.custom]: async () => ({ stdout: '', stderr: '' }),
})

mock.module('#constants', () => ({
    default: {
        internal_api: 'https://internal.example/api',
        vm_api_token: 'service token',
    },
}))
mock.module('node:fs', () => ({ existsSync: () => false, promises: {} }))
mock.module('node:child_process', () => ({ execFile: mockExecFile }))

const { listNativeLogs, listNativeLogServices } = await import('../src/utils/logs/native.ts')
const { mergeLogServices } = await import('../src/utils/logs/services.ts')
const originalFetch = globalThis.fetch
const originalTimeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')!

beforeEach(() => {
    requests.length = 0
    timeoutCalls.length = 0
    fetchCalls = 0
    Object.defineProperty(AbortSignal, 'timeout', {
        configurable: true,
        value: (milliseconds: number) => {
            timeoutCalls.push(milliseconds)
            return timeoutSignal
        },
    })
})

afterEach(() => {
    globalThis.fetch = originalFetch
    Object.defineProperty(AbortSignal, 'timeout', originalTimeoutDescriptor)
})

test('remote native log endpoints share request options and preserve their response contracts', async () => {
    globalThis.fetch = (async (input, init) => {
        const url = String(input)
        requests.push({ url, init })
        if (url.includes('/logs/services?')) {
            return Response.json({ services: [{ service: 'api', last_seen: '2026-10-15T10:00:00.000Z', entries: 7 }] })
        }
        return Response.json({ logs: [{
            id: 'remote-1',
            service: 'api worker',
            host: 'worker-1',
            level: 'error',
            message: 'request failed',
            metadata: { identifier: 'api-worker', native_source: 'remote' },
            created_at: '2026-10-15T10:01:00.000Z',
            source: 'stored',
        }] })
    }) as typeof fetch

    const logs = await listNativeLogs({ service: 'api worker', level: 'error', search: 'failed request', limit: 5 })
    const services = await listNativeLogServices(4)

    expect(requests.map(({ url }) => url)).toEqual([
        'https://internal.example/api/logs?limit=5&service=api+worker&level=error&search=failed+request',
        'https://internal.example/api/logs/services?limit=4',
    ])
    expect(requests.map(({ init }) => init?.headers)).toEqual([
        {
            Authorization: 'Bearer service%20token',
            'Content-Type': 'application/json',
            'User-Agent': 'hanasand_api',
        },
        {
            Authorization: 'Bearer service%20token',
            'Content-Type': 'application/json',
            'User-Agent': 'hanasand_api',
        },
    ])
    expect(requests.every(({ init }) => init?.signal === timeoutSignal)).toBe(true)
    expect(timeoutCalls).toEqual([2000, 2000])
    expect(logs).toEqual([{
        id: 'remote-1',
        service: 'api worker',
        host: 'worker-1',
        level: 'error',
        message: 'request failed',
        metadata: { identifier: 'api-worker', native_source: 'internal_api' },
        created_at: '2026-10-15T10:01:00.000Z',
        source: 'native',
    }])
    expect(services).toEqual([{ service: 'api', last_seen: '2026-10-15T10:00:00.000Z', entries: 7 }])
})

test('remote native endpoints return empty results for non-OK and failed requests', async () => {
    globalThis.fetch = (async () => { fetchCalls++; return new Response(null, { status: 503 }) }) as typeof fetch
    expect(await listNativeLogs({ limit: 5 })).toEqual([])

    globalThis.fetch = (async () => { fetchCalls++; throw new Error('upstream unavailable') }) as typeof fetch
    expect(await listNativeLogServices(4)).toEqual([])
    expect(fetchCalls).toBe(2)
})

test('native and stored service summaries add counts, keep the latest timestamp, and sort by service', () => {
    expect(mergeLogServices([
        [
            { service: 'zeta', last_seen: '2026-10-15T12:00:00.000Z', entries: 1 },
            { service: 'api', last_seen: '2026-10-15T10:00:00.000Z', entries: 2 },
            { service: 'tie', last_seen: '2026-10-15T10:00:00.000Z', entries: 1 },
        ],
        [
            { service: 'api', last_seen: '2026-10-15T11:00:00.000Z', entries: 3 },
            { service: 'alpha', last_seen: '2026-10-15T09:00:00.000Z', entries: 4 },
            { service: 'tie', last_seen: '2026-10-15T11:00:00+01:00', entries: 2 },
        ],
    ])).toEqual([
        { service: 'alpha', last_seen: '2026-10-15T09:00:00.000Z', entries: 4 },
        { service: 'api', last_seen: '2026-10-15T11:00:00.000Z', entries: 5 },
        { service: 'tie', last_seen: '2026-10-15T10:00:00.000Z', entries: 3 },
        { service: 'zeta', last_seen: '2026-10-15T12:00:00.000Z', entries: 1 },
    ])
})
