import { expect, mock, test } from 'bun:test'

const messageScope = { method: 'GET', route: '/api/support/tickets/:id/messages', enabled: true }
mock.module('#utils/auth/session.ts', () => ({ validateSession: async () => null }))
mock.module('#utils/auth/apiKeys.ts', () => ({
    validateApiKey: async () => ({ ownerId: 'svc_test', serviceAccount: true, apiKey: { scopes: [messageScope] } }),
    matchApiKeyScope: () => null,
}))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ hasHanasandInternalPageAccess: async () => false }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: false }) }))
mock.module('#utils/auth/supportServiceKey.ts', () => ({ hasTrustedSupportServiceKey: () => true }))
mock.module('#db', () => ({
    default: async () => ({ rows: [{ id: 'svc_test', name: 'Support monitor' }] }),
    queryOnce: async () => ({ rows: [{ id: 'svc_test', name: 'Support monitor' }] }),
}))

const { authorizeSupport } = await import('../src/handlers/auth/support.ts')

function createReply() {
    const state: { statusCode: number, body?: unknown } = { statusCode: 200 }
    const reply = {
        code(statusCode: number) { state.statusCode = statusCode; return reply },
        send(body: unknown) { state.body = body; return reply },
    }
    return { reply, state }
}

test('support authorization matches service-account route templates to concrete ticket paths', async () => {
    const { reply, state } = createReply()
    await authorizeSupport({
        headers: {},
        body: { method: 'GET', path: '/api/support/tickets/ticket-123/messages', headers: { 'x-api-key': 'service-key' } },
    } as any, reply as any)

    expect(state.statusCode).toBe(200)
    expect(state.body).toMatchObject({ valid: true, serviceAccount: true })
})

test('support authorization denies a concrete path outside the service-account scope', async () => {
    const { reply, state } = createReply()
    await authorizeSupport({
        headers: {},
        body: { method: 'GET', path: '/api/support/tickets/ticket-123/status', headers: { 'x-api-key': 'service-key' } },
    } as any, reply as any)

    expect(state.statusCode).toBe(403)
    expect(state.body).toMatchObject({ valid: false })
})
