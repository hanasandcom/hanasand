import { expect, mock } from 'bun:test'
import Fastify from 'fastify'

export const state: {
    supportSession: Record<string, any> | null
    systemEvents: Array<Record<string, any>>
    queries: Array<{ sql: string, values: unknown[] }>
    failSystemEventWrite: boolean
    actor: Record<string, any>
} = {
    supportSession: null,
    systemEvents: [],
    queries: [],
    failSystemEventWrite: false,
    actor: { valid: true, id: 'admin-user' },
}

const query = async (sql: string, values: unknown[] = []) => {
    state.queries.push({ sql, values })
    if (sql.includes('FROM users') && sql.includes('deletion_scheduled_at IS NULL')) {
        return { rows: [{ id: 'target-user', name: 'Target User', avatar: null }] }
    }
    if (sql.includes('FROM impersonation_sessions s')) {
        return { rows: [{ id: 'impersonation-1', actor_id: 'admin-user', object_id: 'target-user', target_name: 'Target User', reason: 'Support review', audit_context: { scope: [], organizationId: null } }] }
    }
    if (sql.includes('FROM system_events')) return { rows: [{ id: 731 }, { id: 'not-an-id' }] }
    throw new Error(`Unexpected impersonation start query: ${sql}`)
}

mock.module('#db', () => ({ default: query, identityQueryOnce: query, isTransientDatabaseError: () => false }))
const systemEventUtils = await import('../src/utils/systemEvent.ts')
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => state.actor }))
mock.module('#utils/systemEvent.ts', () => ({
    ...systemEventUtils,
    actorHasHanasandInternalAccess: async () => true,
    recordSystemEvent: async (_req: unknown, event: Record<string, any>) => {
        if (state.failSystemEventWrite) throw new Error('audit store unavailable')
        state.systemEvents.push(event)
    },
    requireAuditReason: (value: unknown, label: string) => {
        const reason = typeof value === 'string' ? value.trim() : ''
        if (reason.length < 10) throw new Error(`${label} must be at least 10 characters.`)
        return reason
    },
}))
mock.module('#utils/support/supportSessionState.ts', () => ({ loadSupportSessionState: async () => state.supportSession }))

const { startImpersonation } = await import('../src/handlers/impersonation.ts')
const tokenWrapper = (await import('../src/utils/auth/tokenWrapper.ts?scope-audit-test')).default
export const app = Fastify({ logger: false })
app.post('/impersonation/start', startImpersonation)
app.get('/api/profile', async (req, res) => {
    const auth = await tokenWrapper(req, res, async () => ({
        user: { id: 'admin-user', name: 'Admin', avatar: null, active: true },
        session: { token_id: 1, id: 'admin-user', token: 'actor-token', ip: '', user_agent: '', created_at: '', timestamp: '' },
        refreshed: { token: 'refreshed-token', expires_at: '2030-01-01T00:00:00.000Z' },
    }))
    return res.status(auth.valid ? 200 : 403).send(auth)
})

export function expectDeniedEventLookup(requestId: string, entityId: string) {
    expect(state.queries).toHaveLength(2)
    expect(state.queries[1].sql).toContain('WHERE request_id = $1')
    expect(state.queries[1].sql).toContain('AND event_type = $2')
    expect(state.queries[1].sql).toContain('AND subject_id = $3')
    expect(state.queries[1].sql).toContain('ORDER BY created_at DESC, id DESC')
    expect(state.queries[1].sql).toContain('LIMIT 10')
    expect(state.queries[1].values).toEqual([requestId, 'impersonation.start', entityId])
}

export function resetDenialFixture() {
    state.supportSession = null
    state.systemEvents.length = 0
    state.queries.length = 0
    state.failSystemEventWrite = false
    state.actor = { valid: true, id: 'admin-user' }
}
