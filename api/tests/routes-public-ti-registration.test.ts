import { afterEach, expect, test } from 'bun:test'
import Fastify from 'fastify'

process.env.API_HTTP_ONLY = '1'

const nativeFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = nativeFetch
})

test('mounts the session-authenticated public TI collection routes under /api/v1', async () => {
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example.test'
    globalThis.fetch = (async () => Response.json({ actorProfiles: [{ id: 'actor-1', canonicalName: 'Example Actor' }], total: 1 })) as typeof fetch

    const { default: apiRoutes } = await import('../src/routes.ts')
    const app = Fastify()
    app.addHook('preHandler', async request => {
        if (request.headers['x-test-session'] === 'valid') {
            ;(request as typeof request & { rateLimitSession?: unknown }).rateLimitSession = { user: { id: 'user-1' } }
        }
    })
    await app.register(apiRoutes, { prefix: '/api' })

    try {
        const anonymous = await app.inject({ method: 'GET', url: '/api/v1/actors?limit=1&page=1' })
        const authenticated = await app.inject({ method: 'GET', url: '/api/v1/actors?limit=1&page=1', headers: { 'x-test-session': 'valid' } })

        expect(anonymous.statusCode).toBe(401)
        expect(authenticated.statusCode).toBe(200)
        expect(authenticated.json()).toMatchObject({
            data: [{ id: 'actor-1', canonicalName: 'Example Actor' }],
            pagination: { page: 1, total: 1 },
        })
    } finally {
        await app.close()
        globalThis.fetch = nativeFetch
    }
})
