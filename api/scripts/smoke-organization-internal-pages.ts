import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { canAccessHanasandInternalPageRoute, canEditHanasandInternalPages, canViewHanasandInternalPages, canViewHanasandInternalRoute, HANASAND_ORGANIZATION_ID } from '../src/utils/auth/organizationPagePolicy.ts'
import apiRoutes from '../src/routes.ts'

for (const role of ['owner', 'admin', 'editor', 'reader']) {
    assert.equal(canViewHanasandInternalPages({
        organizationId: HANASAND_ORGANIZATION_ID,
        organizationStatus: 'active',
        membershipStatus: 'active',
        role,
    }), true)
}
for (const role of ['owner', 'admin', 'editor']) {
    const member = { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'active', membershipStatus: 'active', role }
    assert.equal(canEditHanasandInternalPages(member), true)
    assert.equal(canAccessHanasandInternalPageRoute('PATCH', member), true)
}
for (const role of ['reader', 'member', 'viewer']) {
    const member = { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'active', membershipStatus: 'active', role }
    assert.equal(canEditHanasandInternalPages(member), false)
    assert.equal(canAccessHanasandInternalPageRoute('GET', member), true)
    assert.equal(canAccessHanasandInternalPageRoute('POST', member), false)
}
for (const membership of [
    { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'archived', membershipStatus: 'active', role: 'editor' },
    { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'active', membershipStatus: 'removed', role: 'owner' },
    { organizationId: 'other', organizationStatus: 'active', membershipStatus: 'active', role: 'owner' },
]) assert.equal(canViewHanasandInternalPages(membership), false)

for (const [method, route] of [
    ['GET', '/logs/realtime'],
    ['GET', '/api/logs/realtime?since=yesterday'],
    ['GET', '/blocklist/overview'],
    ['GET', '/vms/stop'],
    ['POST', '/logs/search'],
    ['PUT', '/system/cron/:id'],
    ['DELETE', '/users/:id'],
    ['GET', '/api/commercial/contact-requests'],
    ['GET', '/api/thesis'],
] as const) assert.equal(canViewHanasandInternalRoute(method, route), true, `${method} ${route}`)
for (const [method, route] of [
    ['POST', '/support/tickets'],
    ['GET', '/health'],
    ['OPTIONS', '/logs/realtime'],
    ['POST', '/role/assign/:id'],
] as const) assert.equal(canViewHanasandInternalRoute(method, route), false, `${method} ${route}`)

const app = Fastify({ logger: false })
const previousHttpOnly = process.env.API_HTTP_ONLY
process.env.API_HTTP_ONLY = '1'
try {
    await app.register(apiRoutes, { prefix: '/api' })
    await app.ready()
    for (const [method, url] of [
        ['GET', '/api/role/:id'],
        ['GET', '/api/roles'],
        ['GET', '/api/roles/user/:id'],
        ['POST', '/api/role'],
        ['POST', '/api/role/assign/:id'],
        ['POST', '/api/role/unassign/:id'],
        ['PUT', '/api/role/:id'],
        ['DELETE', '/api/role/:id'],
    ] as const) {
        assert.equal(app.hasRoute({ method, url }), false, `Legacy role route remains registered: ${method} ${url}`)
    }
} finally {
    await app.close()
    if (previousHttpOnly === undefined) delete process.env.API_HTTP_ONLY
    else process.env.API_HTTP_ONLY = previousHttpOnly
}

console.log('Organization-only internal page access smoke passed.')
