import { afterAll, expect, test } from 'bun:test'
import Fastify from 'fastify'

const originalApiHttpOnly = process.env.API_HTTP_ONLY
process.env.API_HTTP_ONLY = '1'
const { registerHttpSurface } = await import('../src/registerHttpSurface.ts')

afterAll(() => {
    if (originalApiHttpOnly === undefined) delete process.env.API_HTTP_ONLY
    else process.env.API_HTTP_ONLY = originalApiHttpOnly
})

test('registers canonical public, internal, and application routes on the API surface', async () => {
    const app = Fastify({ logger: false })
    try {
        registerHttpSurface(app, { browserWorkerOnly: false, httpWorkerOnly: true })
        await app.ready()
        expect(app.hasRoute({ method: 'POST', url: '/api/v1/ti/search/batch' })).toBe(true)
        expect(app.hasRoute({ method: 'GET', url: '/api/internal/ti/organization-context/:id' })).toBe(true)
        expect(app.hasRoute({ method: 'GET', url: '/api/app' })).toBe(true)
        expect(app.hasRoute({ method: 'POST', url: '/mill' })).toBe(true)
        expect(app.hasRoute({ method: 'GET', url: '/' })).toBe(true)
    } finally {
        await app.close()
    }
})

test('browser worker mode keeps its health root and omits application routes', async () => {
    const app = Fastify({ logger: false })
    try {
        registerHttpSurface(app, { browserWorkerOnly: true, httpWorkerOnly: true })
        await app.ready()
        expect((await app.inject('/')).json()).toEqual({ ok: true, service: 'browsers' })
        expect(app.hasRoute({ method: 'POST', url: '/api/v1/ti/search/batch' })).toBe(false)
        expect(app.hasRoute({ method: 'POST', url: '/mill' })).toBe(false)
    } finally {
        await app.close()
    }
})
