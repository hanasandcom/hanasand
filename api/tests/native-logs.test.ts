import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { promisify } from 'node:util'

const requests: Array<{ url: string, init?: RequestInit }> = []
const timeoutCalls: number[] = []
const timeoutSignal = new AbortController().signal
const fileContents = new Map<string, string>()
let fetchCalls = 0
let journalOutput = ''
const mockExecFile = Object.assign(() => undefined, {
    [promisify.custom]: async () => ({ stdout: journalOutput, stderr: '' }),
})

mock.module('#constants', () => ({
    default: {
        internal_api: 'https://internal.example/api',
        vm_api_token: 'service token',
    },
}))
mock.module('node:fs', () => ({
    existsSync: (path: string) => fileContents.has(path),
    promises: {
        open: async (path: string) => {
            const content = Buffer.from(fileContents.get(path) || '')
            return {
                stat: async () => ({ size: content.length }),
                read: async (buffer: Buffer, offset: number, length: number, position: number) => {
                    const bytesRead = content.copy(buffer, offset, position, position + length)
                    return { bytesRead, buffer }
                },
                close: async () => undefined,
            }
        },
    },
}))
mock.module('node:child_process', () => ({ execFile: mockExecFile }))

const { listNativeLogs, listNativeLogServices } = await import('../src/utils/logs/native.ts')
const { mergeLogServices } = await import('../src/utils/logs/services.ts')
const originalFetch = globalThis.fetch
const originalTimeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')!

beforeEach(() => {
    requests.length = 0
    timeoutCalls.length = 0
    fileContents.clear()
    journalOutput = ''
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

test('local files and journal rows normalize into the same native log contract', async () => {
    const logPath = '/var/log/auth.log'
    fileContents.set(logPath, 'Oct 15 10:00:00 host sshd[12]: authentication failure\n')
    const logYear = new Date().getFullYear()
    const journalTimestamp = new Date(`${logYear}-10-15T12:00:00.000Z`).toISOString()
    const syslogTimestamp = new Date(`${logYear} Oct 15 10:00:00`).toISOString()
    const journalTime = new Date(journalTimestamp).getTime() * 1000
    journalOutput = JSON.stringify({
        MESSAGE: 'Watch reload',
        _SYSTEMD_UNIT: 'nginx.service',
        _HOSTNAME: 'server-1',
        __REALTIME_TIMESTAMP: String(journalTime),
        PRIORITY: '4',
        _PID: '42',
    })
    globalThis.fetch = (async () => Response.json({ logs: [] })) as typeof fetch

    const logs = await listNativeLogs({ limit: 5 })

    expect(logs).toEqual([
        {
            id: `nginx:${journalTimestamp}:Watch reload`,
            service: 'nginx', host: 'server-1', level: 'warn', message: 'Watch reload',
            metadata: { native_source: 'journalctl', unit: 'nginx.service', identifier: undefined, pid: '42' },
            created_at: journalTimestamp, source: 'native',
        },
        {
            id: `ssh:${syslogTimestamp}:authentication failure`,
            service: 'ssh', host: 'host', level: 'error', message: 'authentication failure',
            metadata: { native_source: 'file', file_path: logPath, identifier: 'sshd[12]' },
            created_at: syslogTimestamp, source: 'native',
        },
    ])
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
