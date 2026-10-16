import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const expectedRoutes = [
    ['GET', '/admin/support/readiness'],
    ['GET', '/admin/support/inspect'],
    ['GET', '/admin/support/users/:id'],
    ['GET', '/admin/support/organizations/:id'],
    ['GET', '/admin/support/organizations/:id/invites/:inviteId'],
    ['GET', '/admin/support/organizations/:id/members/:userId'],
    ['GET', '/admin/support/access-recovery'],
    ['GET', '/admin/support/access-recovery/:requestId'],
    ['GET', '/admin/support/sessions/:sessionId'],
    ['POST', '/admin/support/sessions'],
    ['POST', '/admin/support/sessions/:sessionId/revoke'],
    ['POST', '/admin/support/organizations/:id/invites'],
    ['POST', '/admin/support/organizations/:id/invites/:inviteId/actions'],
    ['POST', '/admin/support/organizations/:id/members/:userId/role-recovery'],
    ['POST', '/admin/support/organizations/:id/access-recovery'],
    ['POST', '/admin/support/access-recovery/:requestId/approve'],
    ['POST', '/admin/support/access-recovery/:requestId/deny'],
] as const

test('production API routes register every admin-support endpoint', () => {
    const apiDirectory = path.resolve(import.meta.dir, '..')
    const routeCheck = `
        const assert = require('node:assert/strict')
        const { default: Fastify } = await import('fastify')
        const { default: apiRoutes } = await import('./src/routes.ts')
        const app = Fastify({ logger: false })
        try {
            await app.register(apiRoutes)
            await app.ready()
            const expectedRoutes = ${JSON.stringify(expectedRoutes)}
            for (const [method, url] of expectedRoutes) {
                assert.equal(app.hasRoute({ method, url }), true, \`Missing \${method} \${url}\`)
            }
            console.log('Production admin-support routes registered.')
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
    expect(result.stdout).toContain('Production admin-support routes registered.')
})
