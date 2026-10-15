import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'

let records: unknown[] = []
let recordFailure: unknown
mock.module('#utils/logs/recordLog.ts', () => ({
    default: async (entry: unknown) => {
        records.push(entry)
        if (recordFailure) throw recordFailure
    },
}))

const { recordHttpErrorResponse } = await import('../src/utils/logs/httpErrors.ts')

function fixtures({
    url = '/api/example',
    statusCode = 500,
    headers = {},
    id = 'request-fallback',
    ip = '192.0.2.10',
}: {
    url?: string
    statusCode?: number
    headers?: Record<string, string | string[] | undefined>
    id?: string
    ip?: string
} = {}) {
    const warnings: unknown[][] = []
    const req = {
        url,
        method: 'POST',
        headers,
        id,
        ip,
        log: { warn: (...args: unknown[]) => warnings.push(args) },
    } as unknown as FastifyRequest
    const res = { statusCode } as FastifyReply
    return { req, res, warnings }
}

beforeEach(() => {
    records = []
    recordFailure = undefined
})

test('skips successful responses, log routes, and expected internal probes', async () => {
    const ignored = [
        { statusCode: 399 },
        { url: '/api/logs/search?query=secret' },
        { url: '/api/status/ready' },
        { url: '/api/traffic/summary' },
        { url: '/api/health/check' },
        { url: '/api/pwned?probe=1', statusCode: 400, headers: { 'user-agent': 'Bun/1.3.11' } },
        { url: '/api/docker', statusCode: 401, headers: { 'user-agent': 'hanasand_internal' } },
        { url: '/api/stats', statusCode: 404, headers: { 'user-agent': 'hanasand_internal' } },
        { url: '/api/vm/worker-1/start', statusCode: 401, headers: { 'user-agent': 'hanasand_internal' } },
        { url: '/api/vms/worker-1/start', statusCode: 404, headers: { 'user-agent': 'hanasand_internal' } },
    ]

    for (const options of ignored) {
        const { req, res } = fixtures(options)
        await recordHttpErrorResponse(req, res, 'ignored')
    }
    expect(records).toEqual([])

    const { req, res } = fixtures({ url: '/api/other', statusCode: 401, headers: { 'user-agent': 'hanasand_internal' } })
    await recordHttpErrorResponse(req, res, 'not an expected probe')
    expect(records).toHaveLength(1)
})

test('records normalized payload, path, surface, and joined request headers', async () => {
    const { req, res } = fixtures({
        url: 'https://hanasand.local/api/organizations/acme?include=members',
        statusCode: 503,
        headers: {
            code: undefined,
            id: ['user-1', 'user-2'],
            'x-request-id': ['request-1', 'request-2'],
            'user-agent': ['agent-a', 'agent-b'],
            referer: ['/previous', '/source'],
        },
        ip: '198.51.100.7',
    })

    await recordHttpErrorResponse(req, res, Buffer.from(JSON.stringify({ code: ' Invalid Request / Bad ', message: '  No access  ' })))

    expect(records).toEqual([{
        service: 'hanasand-api',
        level: 'error',
        message: 'POST /api/organizations/acme failed with 503 invalid_request_bad',
        metadata: {
            category: 'http_response_error',
            surface: 'organizations',
            method: 'POST',
            path: '/api/organizations/acme',
            status_code: 503,
            error_code: 'invalid_request_bad',
            error_message: 'No access',
            request_id: 'request-1, request-2',
            user_id: 'user-1, user-2',
            ip: '198.51.100.7',
            user_agent: 'agent-a, agent-b',
            referer: '/previous, /source',
        },
    }])
})

test('uses status fallback for malformed and oversized payloads', async () => {
    for (const payload of ['{not-json', 'x'.repeat(20_001)]) {
        const { req, res } = fixtures({ url: '/api/auth/session?next=%2Fhome', statusCode: 400 })
        await recordHttpErrorResponse(req, res, payload)
    }

    expect(records).toHaveLength(2)
    for (const entry of records as Array<{ message: string, metadata: Record<string, unknown> }>) {
        expect(entry.message).toBe('POST /api/auth/session failed with 400')
        expect(entry.metadata).toMatchObject({
            surface: 'auth',
            path: '/api/auth/session',
            error_code: '',
            error_message: 'HTTP 400',
        })
    }
})

test('swallows recorder failures after logging a warning', async () => {
    recordFailure = new Error('database unavailable')
    const { req, res, warnings } = fixtures()

    await expect(recordHttpErrorResponse(req, res, '{}')).resolves.toBeUndefined()

    expect(records).toHaveLength(1)
    expect(warnings).toEqual([[{ error: recordFailure }, 'Failed to persist HTTP error response']])
})
