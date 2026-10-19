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
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'admin' }) }))

const tokenWrapper = (await import('../src/utils/auth/tokenWrapper.ts?minimal-impersonation-test')).default
const { createImpersonationToken, startImpersonation } = await import('../src/handlers/impersonation/start.ts')
const app = Fastify({ logger: false })
app.all('/api/users/:id', async (req, res) => {
    const auth = await tokenWrapper(req, res, async () => ({
        user: { id: 'admin', name: 'Eirik Hanasand', active: true },
        refreshed: { token: 'refreshed', expires_at: '2030-01-01T00:00:00.000Z' },
    } as never))
    return res.status(auth.valid ? 200 : 403).send(auth)
})
app.post('/api/impersonation/start', startImpersonation)

afterAll(() => app.close())

test('token selects the target and records the actor, action and target', async () => {
    const response = await app.inject({
        method: 'DELETE',
        url: '/api/users/sindre',
        headers: { authorization: 'Bearer actor-token', id: 'admin', 'x-impersonation-token': createImpersonationToken('target') },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ valid: true, id: 'target', authenticatedId: 'admin', impersonating: true })
    expect(state.events.at(-1)).toMatchObject({
        actionType: 'impersonation.action', actorId: 'admin', targetId: 'target',
        context: { description: 'Eirik Hanasand deleted /api/users/sindre while impersonating Herman' },
    })
})

test('malformed token is rejected', async () => {
    const response = await app.inject({
        method: 'GET', url: '/api/users/target',
        headers: { authorization: 'Bearer actor-token', id: 'admin', 'x-impersonation-token': 'target' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ valid: false, error: 'Impersonation is not authorized.' })
})

test('only internal admins can impersonate users', async () => {
    state.internalAdmin = false
    const response = await app.inject({
        method: 'GET', url: '/api/users/target',
        headers: { authorization: 'Bearer actor-token', id: 'admin', 'x-impersonation-token': createImpersonationToken('target') },
    })
    state.internalAdmin = true

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ valid: false, error: 'Impersonation is not authorized.' })
})

test('start returns the minimal target token', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/impersonation/start', payload: { targetId: 'target' } })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ token: 'impersonation:target', target: { id: 'target', name: 'Herman' } })
})
