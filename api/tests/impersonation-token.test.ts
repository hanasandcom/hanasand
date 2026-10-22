import { afterAll, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const state = { internalAdmin: true, events: [] as Array<Record<string, any>> }
mock.module('#db', () => ({
    default: async (sql: string) => sql.includes('FROM users')
        ? { rows: [{ id: 'target', name: 'Herman' }] }
        : { rows: [] },
    isTransientDatabaseError: () => false,
}))
mock.module('#utils/systemEvent.ts', () => ({
    actorHasHanasandInternalAccess: async () => state.internalAdmin,
    recordSystemEvent: async (_req: unknown, event: Record<string, any>) => { state.events.push(event) },
}))

const tokenWrapper = (await import('../src/utils/auth/tokenWrapper.ts?identity-owned-impersonation-test')).default
const app = Fastify({ logger: false })
app.all('/api/users/:id', async (req, res) => {
    const auth = await tokenWrapper(req, res, async () => ({
        user: { id: 'admin', name: 'Eirik Hanasand', active: true },
        refreshed: { token: 'refreshed', expires_at: '2030-01-01T00:00:00.000Z' },
    } as never))
    return res.status(auth.valid ? 200 : 403).send(auth)
})

afterAll(() => app.close())

test('impersonation token selects the target and audits the actor action', async () => {
    const response = await app.inject({
        method: 'DELETE',
        url: '/api/users/sindre',
        headers: { authorization: 'Bearer actor-token', id: 'admin', 'x-impersonation-token': 'impersonation:target' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ valid: true, id: 'target', authenticatedId: 'admin', impersonating: true })
    expect(state.events.at(-1)).toMatchObject({
        actionType: 'impersonation.action', actorId: 'admin', targetId: 'target',
        context: { description: 'Eirik Hanasand deleted /api/users/sindre while impersonating Herman' },
    })
})

test('malformed and self-targeted impersonation tokens are rejected', async () => {
    const malformed = await app.inject({
        method: 'GET', url: '/api/users/target',
        headers: { authorization: 'Bearer actor-token', id: 'admin', 'x-impersonation-token': 'target' },
    })
    expect(malformed.statusCode).toBe(403)
    expect(malformed.json()).toMatchObject({ valid: false, error: 'Impersonation is not authorized.' })

    const selfTargeted = await app.inject({
        method: 'GET', url: '/api/users/admin',
        headers: { authorization: 'Bearer actor-token', id: 'admin', 'x-impersonation-token': 'impersonation:admin' },
    })
    expect(selfTargeted.statusCode).toBe(403)
    expect(selfTargeted.json()).toMatchObject({ valid: false, error: 'Impersonation is not authorized.' })
})

test('only internal admins can impersonate users', async () => {
    state.internalAdmin = false
    const response = await app.inject({
        method: 'GET', url: '/api/users/target',
        headers: { authorization: 'Bearer actor-token', id: 'admin', 'x-impersonation-token': 'impersonation:target' },
    })
    state.internalAdmin = true

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ valid: false, error: 'Impersonation is not authorized.' })
})
