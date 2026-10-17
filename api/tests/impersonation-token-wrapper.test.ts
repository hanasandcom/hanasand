import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const systemEventUtils = await import('../src/utils/systemEvent.ts')
mock.module('#db', () => ({
    default: async (sql: string) => sql.includes('FROM impersonation_sessions s')
        ? { rows: [{ id: 'session-1', actor_id: 'admin', object_id: 'target', target_name: 'Target', reason: 'Support review', audit_context: { scope: [' READ_PROFILE '], organizationId: 'org-1' } }] }
        : { rows: [] },
    isTransientDatabaseError: () => false,
}))
mock.module('#utils/systemEvent.ts', () => ({ ...systemEventUtils, recordSystemEvent: async () => {} }))

const tokenWrapper = (await import('../src/utils/auth/tokenWrapper.ts?authorized-impersonation-test')).default
const app = Fastify({ logger: false })
app.get('/api/profile', async (req, res) => {
    const auth = await tokenWrapper(req, res, async () => ({
        user: { id: 'admin', name: 'Admin', active: true },
        refreshed: { token: 'refreshed-token', expires_at: '2030-01-01T00:00:00.000Z' },
    } as never))
    return res.status(auth.valid ? 200 : 403).send(auth)
})

test('authorized impersonation preserves target identity and refreshed-token headers', async () => {
    const response = await app.inject({
        method: 'GET',
        url: '/api/profile?view=summary',
        headers: {
            authorization: 'Bearer actor-token',
            id: 'admin',
            'x-impersonation-token': 'impersonation-token',
        },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ valid: true, id: 'target', authenticatedId: 'admin', impersonating: true })
    expect(response.headers).toMatchObject({
        'x-access-token': 'refreshed-token',
        'x-access-token-expires-at': '2030-01-01T00:00:00.000Z',
        'x-impersonating-id': 'target',
        'x-impersonating-name': 'Target',
        'x-authenticated-id': 'admin',
        'x-impersonation-session-id': 'session-1',
    })
})
