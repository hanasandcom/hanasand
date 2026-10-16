import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

type QueryCall = { sql: string; params: unknown[] }

const calls: QueryCall[] = []
const transactionCalls: QueryCall[] = []
let rows: Array<Record<string, unknown>> = []
let failure: Error | undefined
let transactionCount = 0
let transactionFailureOnCall: number | undefined

mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params })
        if (failure) throw failure
        if (/^\s*SELECT/.test(sql)) return { rows }
        return { rows: [] }
    },
    withTransaction: async (work: (query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>) => Promise<unknown>) => {
        transactionCount++
        return work(async (sql, params = []) => {
            transactionCalls.push({ sql, params })
            if (transactionFailureOnCall === transactionCalls.length) throw failure ?? new Error('Transaction query failed')
            return { rows: [] }
        })
    },
}))

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async (request: { headers: Record<string, string | string[] | undefined> }) => {
        const id = request.headers.id
        return typeof id === 'string' ? { valid: true, id } : { valid: false }
    },
}))

const { default: browserSandboxProfileRoutes } = await import('../src/routes/browserSandboxProfiles.ts')

beforeEach(() => {
    calls.length = 0
    transactionCalls.length = 0
    rows = []
    failure = undefined
    transactionCount = 0
    transactionFailureOnCall = undefined
})

afterEach(() => {
    calls.length = 0
    transactionCalls.length = 0
})

test('registers canonical and legacy profile routes with the same read and save behavior', async () => {
    const app = await createApp()
    try {
        for (const path of ['/browser/profiles', '/browser-sandbox/profiles']) {
            const response = await app.inject({ method: 'GET', url: path, headers: { id: 'owner-7' } })
            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({ profiles: [] })
        }

        for (const path of ['/browser/profiles', '/browser-sandbox/profiles']) {
            const response = await app.inject({ method: 'PUT', url: path, headers: { id: 'owner-7' }, payload: { profiles: [] } })
            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({ profiles: [] })
        }

        expect(calls.filter(call => /^\s*SELECT/.test(call.sql))).toHaveLength(2)
        expect(transactionCalls.filter(call => /DELETE FROM browser_sandbox_profiles/.test(call.sql))).toHaveLength(2)
        expect(transactionCount).toBe(2)
    } finally {
        await app.close()
    }
})

test('requires authentication before reading or changing profiles', async () => {
    const app = await createApp()
    try {
        const responses = await Promise.all([
            app.inject({ method: 'GET', url: '/browser/profiles' }),
            app.inject({ method: 'PUT', url: '/browser/profiles', payload: { profiles: [] } }),
        ])

        expect(responses.map(response => response.statusCode)).toEqual([401, 401])
        expect(responses.map(response => response.json())).toEqual([
            { error: 'Unauthorized.' },
            { error: 'Unauthorized.' },
        ])
        expect(calls).toHaveLength(0)
        expect(transactionCalls).toHaveLength(0)
        expect(transactionCount).toBe(0)
    } finally {
        await app.close()
    }
})

test('reads profiles only for the authenticated owner and normalizes stored tools', async () => {
    rows = [{
        id: 'work',
        name: 'Work',
        tools: [
            { id: 'home', name: 'Home', url: 'https://example.test/path#fragment' },
            { id: 'bad', name: 'Bad', url: 'javascript:alert(1)' },
        ],
        created_at: 'created',
        updated_at: 'updated',
    }]
    const app = await createApp()
    try {
        const response = await app.inject({ method: 'GET', url: '/browser/profiles', headers: { id: 'owner-8' } })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
            profiles: [{
                id: 'work',
                name: 'Work',
                tools: [{ id: 'home', name: 'Home', url: 'https://example.test/path' }],
                createdAt: 'created',
                updatedAt: 'updated',
            }],
        })
        expect(calls).toHaveLength(1)
        expect(calls[0].sql).toContain('WHERE owner_id = $1')
        expect(calls[0].params).toEqual(['owner-8'])
    } finally {
        await app.close()
    }
})

test('normalizes and persists only bounded, valid profiles and tools for the owner', async () => {
    const tools = [
        ...Array.from({ length: 9 }, (_, index) => ({ name: `Tool ${index}`, url: `https://example.test/${index}#section` })),
        { id: 'bad-url', name: 'Bad URL', url: 'file:///etc/passwd' },
    ]
    const app = await createApp()
    try {
        const response = await app.inject({
            method: 'PUT',
            url: '/browser/profiles',
            headers: { id: 'owner-9' },
            payload: {
                profiles: [
                    { id: ' My Profile! ', name: '  Main profile  ', tools },
                    { id: 'my-profile', name: 'Duplicate id', tools: [] },
                    { id: 'empty-name', name: '  ', tools: [] },
                    null,
                ],
            },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
            profiles: [{
                id: 'my-profile',
                name: 'Main profile',
                tools: Array.from({ length: 8 }, (_, index) => ({
                    id: `tool-${index}`,
                    name: `Tool ${index}`,
                    url: `https://example.test/${index}`,
                })),
            }],
        })
        expect(calls).toHaveLength(0)
        expect(transactionCount).toBe(1)
        expect(transactionCalls).toHaveLength(2)
        expect(transactionCalls[0].sql).toContain('DELETE FROM browser_sandbox_profiles WHERE owner_id = $1')
        expect(transactionCalls[0].params).toEqual(['owner-9', ['my-profile']])
        expect(transactionCalls[1].sql).toContain('ON CONFLICT (owner_id, id)')
        expect(transactionCalls[1].params).toEqual([
            'owner-9',
            'my-profile',
            'Main profile',
            JSON.stringify(Array.from({ length: 8 }, (_, index) => ({
                id: `tool-${index}`,
                name: `Tool ${index}`,
                url: `https://example.test/${index}`,
            }))),
        ])
    } finally {
        await app.close()
    }
})

test('rejects a non-array or more than sixteen profiles without touching storage', async () => {
    const app = await createApp()
    try {
        const responses = await Promise.all([
            app.inject({ method: 'PUT', url: '/browser/profiles', headers: { id: 'owner' }, payload: { profiles: null } }),
            app.inject({ method: 'PUT', url: '/browser/profiles', headers: { id: 'owner' }, payload: { profiles: Array.from({ length: 17 }, (_, index) => ({ id: `p-${index}`, name: `Profile ${index}` })) } }),
        ])

        expect(responses.map(response => response.statusCode)).toEqual([400, 400])
        expect(responses.map(response => response.json())).toEqual([
            { error: 'Profiles must be an array.' },
            { error: 'Save 16 profiles or fewer.' },
        ])
        expect(calls).toHaveLength(0)
    } finally {
        await app.close()
    }
})

test('returns stable server errors when profile reads or writes fail', async () => {
    const app = await createApp()
    try {
        failure = new Error('database details')
        const read = await app.inject({ method: 'GET', url: '/browser/profiles', headers: { id: 'owner' } })
        expect(read.statusCode).toBe(500)
        expect(read.json()).toEqual({ error: 'Failed to load browser sandbox profiles.' })

        calls.length = 0
        transactionFailureOnCall = 2
        const write = await app.inject({
            method: 'PUT',
            url: '/browser/profiles',
            headers: { id: 'owner' },
            payload: { profiles: [{ id: 'new-profile', name: 'New profile', tools: [] }] },
        })
        expect(write.statusCode).toBe(500)
        expect(write.json()).toEqual({ error: 'Failed to save browser sandbox profiles.' })
        expect(transactionCount).toBe(1)
        expect(transactionCalls).toHaveLength(2)
        expect(transactionCalls[0].sql).toContain('DELETE FROM browser_sandbox_profiles')
        expect(transactionCalls[1].sql).toContain('INSERT INTO browser_sandbox_profiles')
        expect(calls).toHaveLength(0)
    } finally {
        await app.close()
    }
})

test('keeps the browser profile table owner-scoped and indexed by update time', async () => {
    const schema = await Bun.file(new URL('../src/utils/db/ensureSchema.ts', import.meta.url)).text()

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS browser_sandbox_profiles')
    expect(schema).toContain('PRIMARY KEY (owner_id, id)')
    expect(schema).toContain('idx_browser_sandbox_profiles_owner_updated')
})

async function createApp() {
    const app = Fastify({ logger: false })
    await app.register(browserSandboxProfileRoutes)
    return app
}
