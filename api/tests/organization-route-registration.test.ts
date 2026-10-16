import { expect, test } from 'bun:test'
import Fastify from 'fastify'

test('production route plugin proxies both organization listing routes to Identity', async () => {
    const previousApiHttpOnly = process.env.API_HTTP_ONLY
    const previousIdentityUrl = process.env.HANASAND_IDENTITY_SERVICE_URL
    const originalFetch = globalThis.fetch
    const forwardedUrls: string[] = []

    process.env.API_HTTP_ONLY = '1'
    process.env.HANASAND_IDENTITY_SERVICE_URL = 'http://identity.test'
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        forwardedUrls.push(String(input))
        return new Response(JSON.stringify({ organizations: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })
    }) as typeof fetch

    const app = Fastify()
    try {
        const { default: apiRoutes } = await import('../src/routes.ts')
        await app.register(apiRoutes)
        await app.ready()

        for (const route of ['/management/organizations', '/organizations']) {
            const response = await app.inject({ method: 'GET', url: route })
            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({ organizations: [] })
        }

        expect(forwardedUrls).toEqual([
            'http://identity.test/management/organizations',
            'http://identity.test/organizations',
        ])
    } finally {
        await app.close()
        globalThis.fetch = originalFetch
        if (previousApiHttpOnly === undefined) delete process.env.API_HTTP_ONLY
        else process.env.API_HTTP_ONLY = previousApiHttpOnly
        if (previousIdentityUrl === undefined) delete process.env.HANASAND_IDENTITY_SERVICE_URL
        else process.env.HANASAND_IDENTITY_SERVICE_URL = previousIdentityUrl
    }
})
