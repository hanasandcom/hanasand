import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

test('registers saved-search routes on the production API plugin', () => {
    const apiDirectory = path.resolve(import.meta.dir, '..')
    const routeCheck = `
        const assert = require('node:assert/strict')
        const { default: Fastify } = await import('fastify')
        const { default: apiRoutes } = await import('./src/routes.ts')
        const app = Fastify({ logger: false })
        try {
            await app.register(apiRoutes)
            await app.ready()
            for (const [method, url] of [
                ['GET', '/ti/saved-searches'],
                ['POST', '/ti/saved-searches'],
                ['DELETE', '/ti/saved-searches'],
            ]) {
                assert.equal(app.hasRoute({ method, url }), true, 'Missing ' + method + ' ' + url)
            }
            console.log('Production TI saved-search routes registered.')
        } finally {
            await app.close()
        }
    `
    const result = spawnSync(process.execPath, ['-e', routeCheck], {
        cwd: apiDirectory,
        env: { ...process.env, API_HTTP_ONLY: '1' },
        encoding: 'utf8',
        timeout: 15_000,
    })

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Production TI saved-search routes registered.')
})
