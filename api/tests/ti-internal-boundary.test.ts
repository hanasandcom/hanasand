import { expect, test } from 'bun:test'
import Fastify from 'fastify'
import tiInternalApi from '../src/handlers/ti/internal.ts'

test('denies internal TI requests when the service token is not configured', async () => {
    const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
    delete process.env.TI_SCRAPER_SERVICE_TOKEN
    const app = Fastify()
    try {
        await app.register(tiInternalApi, {})
        const response = await app.inject({ method: 'GET', url: '/watchlist-context', headers: { 'x-hanasand-service-token': 'unexpected-token' } })
        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({ error: 'authentication_required' })
    } finally {
        await app.close()
        if (previousToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
        else process.env.TI_SCRAPER_SERVICE_TOKEN = previousToken
    }
})

test('denies internal TI requests with a mismatched service token', async () => {
    const app = Fastify()
    try {
        await app.register(tiInternalApi, { token: 'expected-token' })
        const response = await app.inject({ method: 'GET', url: '/watchlist-context', headers: { 'x-hanasand-service-token': 'wrong-token' } })
        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({ error: 'authentication_required' })
    } finally {
        await app.close()
    }
})
