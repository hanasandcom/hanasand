import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { readFile } from 'node:fs/promises'

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async (request: { headers: Record<string, string | string[] | undefined> }) => {
        const id = request.headers.id
        return typeof id === 'string' ? { valid: true, id } : { valid: false }
    },
}))

import { deleteSavedSearch, getSavedSearches, postSavedSearch } from '../src/handlers/ti/savedSearches.ts'

type FetchCall = { url: URL; init: RequestInit }
let calls: FetchCall[]
let fetchResponse: Response
let fetchError: Error | undefined
let originalFetch: typeof fetch
let originalBase: string | undefined
let originalToken: string | undefined

beforeEach(() => {
    calls = []
    fetchResponse = Response.json({})
    fetchError = undefined
    originalFetch = globalThis.fetch
    originalBase = process.env.TI_SCRAPER_API_BASE
    originalToken = process.env.TI_SCRAPER_SERVICE_TOKEN
    process.env.TI_SCRAPER_API_BASE = ' https://ti-scraper.example/ '
    process.env.TI_SCRAPER_SERVICE_TOKEN = ' service-secret '
    globalThis.fetch = async (input, init = {}) => {
        calls.push({ url: new URL(String(input)), init })
        if (fetchError) throw fetchError
        return fetchResponse
    }
})

afterEach(() => {
    globalThis.fetch = originalFetch
    restoreEnvironment('TI_SCRAPER_API_BASE', originalBase)
    restoreEnvironment('TI_SCRAPER_SERVICE_TOKEN', originalToken)
})

test('requires a user session before forwarding any saved-search operation', async () => {
    const app = await createApp()
    try {
        const responses = await Promise.all([
            app.inject({ method: 'GET', url: '/saved-searches' }),
            app.inject({ method: 'POST', url: '/saved-searches', payload: { query: 'APT29' } }),
            app.inject({ method: 'DELETE', url: '/saved-searches?query=APT29' }),
        ])

        expect(responses.map(response => response.statusCode)).toEqual([401, 401, 401])
        expect(responses.map(response => response.json())).toEqual([
            { error: 'Unauthorized.' },
            { error: 'Unauthorized.' },
            { error: 'Unauthorized.' },
        ])
        expect(calls).toHaveLength(0)
    } finally {
        await app.close()
    }
})

test('lists saved searches for the authenticated user and maps either timestamp field', async () => {
    fetchResponse = Response.json({
        savedSearches: [
            { query: 'APT29', saved_at: '2026-01-02T03:04:05.000Z' },
            { query: 'CVE-2024-3094', savedAt: '2026-02-03T04:05:06.000Z' },
        ],
    })
    const app = await createApp()
    try {
        const response = await app.inject({ method: 'GET', url: '/saved-searches', headers: { id: 'user-17' } })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
            savedSearches: [
                { query: 'APT29', savedAt: '2026-01-02T03:04:05.000Z' },
                { query: 'CVE-2024-3094', savedAt: '2026-02-03T04:05:06.000Z' },
            ],
        })
        expect(calls).toHaveLength(1)
        expect(calls[0].url.toString()).toBe('https://ti-scraper.example/v1/internal/saved-searches?userId=user-17')
        expect(calls[0].init).toMatchObject({ method: 'GET', headers: { accept: 'application/json', 'x-hanasand-service-token': 'service-secret' } })
        expect(calls[0].init.signal).toBeInstanceOf(AbortSignal)
    } finally {
        await app.close()
    }
})

test('trims and forwards a saved query, then maps the upstream result', async () => {
    fetchResponse = Response.json({ savedSearch: { query: 'APT29', saved_at: '2026-03-04T05:06:07.000Z' } })
    const app = await createApp()
    try {
        const response = await app.inject({
            method: 'POST',
            url: '/saved-searches',
            headers: { id: 'user-22' },
            payload: { query: '  APT29  ' },
        })

        expect(response.statusCode).toBe(201)
        expect(response.json()).toEqual({ savedSearch: { query: 'APT29', savedAt: '2026-03-04T05:06:07.000Z' } })
        expect(calls).toHaveLength(1)
        expect(calls[0].url.toString()).toBe('https://ti-scraper.example/v1/internal/saved-searches?userId=user-22')
        expect(calls[0].url.searchParams.get('userId')).toBe('user-22')
        expect(calls[0].init).toMatchObject({
            method: 'POST',
            headers: { accept: 'application/json', 'content-type': 'application/json', 'x-hanasand-service-token': 'service-secret' },
            body: JSON.stringify({ query: 'APT29' }),
        })
    } finally {
        await app.close()
    }
})

test('deletes the requested saved query for the authenticated user', async () => {
    fetchResponse = Response.json({ ok: true })
    const app = await createApp()
    try {
        const response = await app.inject({ method: 'DELETE', url: '/saved-searches?query=APT29%20%26%20friends', headers: { id: 'user-31' } })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ ok: true })
        expect(calls).toHaveLength(1)
        expect(calls[0].url.toString()).toBe('https://ti-scraper.example/v1/internal/saved-searches?userId=user-31&query=APT29+%26+friends')
        expect(calls[0].url.searchParams.get('userId')).toBe('user-31')
        expect(calls[0].url.searchParams.get('query')).toBe('APT29 & friends')
        expect(calls[0].init).toMatchObject({ method: 'DELETE', headers: { accept: 'application/json', 'x-hanasand-service-token': 'service-secret' } })
    } finally {
        await app.close()
    }
})

test('rejects invalid save and delete requests before contacting the TI service', async () => {
    const app = await createApp()
    try {
        const responses = await Promise.all([
            app.inject({ method: 'POST', url: '/saved-searches', headers: { id: 'user-17' }, payload: { query: '   ' } }),
            app.inject({ method: 'POST', url: '/saved-searches', headers: { id: 'user-17' }, payload: { query: 'x'.repeat(201) } }),
            app.inject({ method: 'POST', url: '/saved-searches', headers: { id: 'user-17' }, payload: { query: 42 } }),
            app.inject({ method: 'DELETE', url: '/saved-searches?query=%20%20', headers: { id: 'user-17' } }),
        ])

        expect(responses.map(response => response.statusCode)).toEqual([400, 400, 400, 400])
        expect(responses.slice(0, 3).map(response => response.json())).toEqual([
            { error: 'Search query must be between 1 and 200 characters.' },
            { error: 'Search query must be between 1 and 200 characters.' },
            { error: 'Search query must be between 1 and 200 characters.' },
        ])
        expect(responses[3].json()).toEqual({ error: 'Search query is required.' })
        expect(calls).toHaveLength(0)
    } finally {
        await app.close()
    }
})

test('returns a stable unavailable response when the TI service fails', async () => {
    fetchResponse = Response.json({ error: 'upstream unavailable' }, { status: 503 })
    const app = await createApp()
    try {
        const response = await app.inject({ method: 'GET', url: '/saved-searches', headers: { id: 'user-17' } })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({ error: 'Threat-intelligence search is temporarily unavailable.' })
        expect(calls).toHaveLength(1)
    } finally {
        await app.close()
    }
})

test('returns the same unavailable response when the TI service request is rejected', async () => {
    fetchError = new Error('connection refused')
    const app = await createApp()
    try {
        const response = await app.inject({ method: 'POST', url: '/saved-searches', headers: { id: 'user-17' }, payload: { query: 'APT29' } })

        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({ error: 'Threat-intelligence search is temporarily unavailable.' })
        expect(calls).toHaveLength(1)
    } finally {
        await app.close()
    }
})

test('registers all saved-search operations on the production API routes', async () => {
    // Mounting apiRoutes imports the full API handler graph and can start database-pool work.
    // Keep request behavior isolated above and guard the three production registrations directly.
    const routes = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8')
    const routeBlock = routes.match(/\/\/ Threat intelligence saved searches([\s\S]*?)\/\/ Organizations/)?.[1] ?? ''

    expect(routeBlock).toContain('fastify.get(\'/ti/saved-searches\', getSavedSearches)')
    expect(routeBlock).toContain('fastify.post(\'/ti/saved-searches\', postSavedSearch)')
    expect(routeBlock).toContain('fastify.delete(\'/ti/saved-searches\', deleteSavedSearch)')
})

async function createApp(): Promise<FastifyInstance> {
    const app = Fastify()
    app.get('/saved-searches', getSavedSearches)
    app.post('/saved-searches', postSavedSearch)
    app.delete('/saved-searches', deleteSavedSearch)
    return app
}

function restoreEnvironment(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
}
