import { expect, test } from 'bun:test'
import { controlApp } from './ti-scraper-control-test-app.ts'

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
