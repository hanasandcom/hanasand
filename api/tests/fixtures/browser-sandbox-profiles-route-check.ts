import { strict as assert } from 'node:assert'
import Fastify from 'fastify'
import apiRoutes from '../../src/routes.ts'

const app = Fastify({ logger: false })
try {
    await app.register(apiRoutes)
    await app.ready()

    for (const url of ['/browser/profiles', '/browser-sandbox/profiles']) {
        assert.equal(app.hasRoute({ method: 'GET', url }), true, `Missing GET ${url}`)
        assert.equal(app.hasRoute({ method: 'PUT', url }), true, `Missing PUT ${url}`)
    }

    console.log('Production browser profile routes registered.')
} finally {
    await app.close()
}
