import { afterEach, expect, test } from 'bun:test'
import Fastify from 'fastify'
import { HANASAND_ORGANIZATION_ID } from '../src/utils/auth/organizationPagePolicy.ts'
import { getTiScraperControl, postTiScraperControl } from '../src/handlers/ti/scraperControl.ts'

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalBase
})

test('requires an authenticated session before contacting the TI scraper', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let fetchCount = 0
    globalThis.fetch = async () => {
        fetchCount++
        return Response.json({})
    }
    const app = controlApp()

    try {
        const response = await app.inject({ method: 'POST', url: '/api/ti/scraper/control', payload: { action: 'scheduler_run_now' } })
        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({ error: 'authentication_required' })
        expect(fetchCount).toBe(0)
    } finally {
        await app.close()
    }
})

test('does not cache an authentication error when API-key auth lacks the scraper bearer token', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let fetchCount = 0
    globalThis.fetch = async () => {
        fetchCount++
        return Response.json({})
    }
    const app = controlApp('viewer', true)

    try {
        const response = await app.inject({ method: 'POST', url: '/api/ti/scraper/control', payload: { action: 'scheduler_run_now' } })
        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({ error: 'authentication_required' })
        expect(response.headers['cache-control']).toBe('no-store, max-age=0')
        expect(fetchCount).toBe(0)
    } finally {
        await app.close()
    }
})

test('allows internal members to read control status but not change source state', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let fetchCount = 0
    globalThis.fetch = async () => {
        fetchCount++
        return Response.json({})
    }
    const app = controlApp('viewer')

    try {
        const read = await app.inject({ method: 'GET', url: '/api/ti/scraper/control', headers: { authorization: 'Bearer session-token' } })
        expect(read.statusCode).toBe(200)
        const requestsAfterRead = fetchCount
        expect(requestsAfterRead).toBeGreaterThan(0)

        const write = await app.inject({
            method: 'POST',
            url: '/api/ti/scraper/control',
            headers: { authorization: 'Bearer session-token' },
            payload: { action: 'source_status', sourceId: 'feed-1', status: 'paused' },
        })
        expect(write.statusCode).toBe(403)
        expect(write.json()).toEqual({ error: 'internal_access_required' })
        expect(write.headers['cache-control']).toBe('no-store, max-age=0')
        expect(fetchCount).toBe(requestsAfterRead)
    } finally {
        await app.close()
    }
})

test('forwards a source status change for an internal editor', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test/'
    let forwardedUrl = ''
    let forwardedInit: RequestInit | undefined
    globalThis.fetch = async (input, init) => {
        forwardedUrl = String(input)
        forwardedInit = init
        return Response.json({ source: { id: 'feed/one', status: 'paused' } })
    }
    const app = controlApp('editor')

    try {
        const response = await app.inject({
            method: 'POST',
            url: '/api/ti/scraper/control',
            headers: { authorization: 'Bearer session-token' },
            payload: { action: 'source_status', sourceId: 'feed/one', tenantId: 'tenant-a', status: 'paused' },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({ ok: true, payload: { source: { id: 'feed/one', status: 'paused' } } })
        expect(new URL(forwardedUrl).pathname).toBe('/v1/sources/feed%2Fone')
        expect(forwardedInit?.method).toBe('PATCH')
        expect(JSON.parse(String(forwardedInit?.body))).toEqual({ status: 'paused', tenantId: 'tenant-a' })
        expect(new Headers(forwardedInit?.headers).get('authorization')).toBe('Bearer session-token')
        expect(new Headers(forwardedInit?.headers).get('x-actor-id')).toBe('ti-operator')
    } finally {
        await app.close()
    }
})

test('routes a manual collection request through the scraper scheduler', async () => {
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    let forwardedUrl = ''
    let forwardedBody: unknown
    globalThis.fetch = async (input, init) => {
        forwardedUrl = String(input)
        forwardedBody = JSON.parse(String(init?.body))
        return Response.json({ scheduled: true })
    }
    const app = controlApp('editor')

    try {
        const response = await app.inject({
            method: 'POST',
            url: '/api/ti/scraper/control',
            headers: { authorization: 'Bearer session-token' },
            payload: { action: 'scheduler_run_now' },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toMatchObject({ ok: true, payload: { scheduled: true } })
        expect(new URL(forwardedUrl).pathname).toBe('/v1/ops/collection-scheduler')
        expect(forwardedBody).toEqual({ action: 'run_now', approvedBy: 'dashboard/ti/control', reason: 'operator source scheduler control' })
    } finally {
        await app.close()
    }
})

function controlApp(role?: string, withApiKey = false) {
    const app = Fastify()
    if (role || withApiKey) {
        app.addHook('onRequest', (request, _reply, done) => {
            request.headers.id = 'ti-operator'
            Object.assign(request, {
                ...(withApiKey ? { apiKeyAuth: { ownerId: 'ti-operator' } } : {}),
                ...(role ? { rateLimitSession: {
                    user: { id: 'ti-operator' },
                    organizationMembership: {
                        organizationId: HANASAND_ORGANIZATION_ID,
                        organizationStatus: 'active',
                        membershipStatus: 'active',
                        role,
                    },
                    refreshed: { token: 'session-token', expires_at: '2030-01-01T00:00:00.000Z' },
                } } : {}),
            })
            done()
        })
    }
    app.get('/api/ti/scraper/control', getTiScraperControl)
    app.post('/api/ti/scraper/control', postTiScraperControl)
    return app
}
