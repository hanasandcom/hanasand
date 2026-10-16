import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let supportSession: Record<string, any> | null = null
const systemEvents: Array<Record<string, any>> = []
const queries: string[] = []

const query = async (sql: string) => {
    queries.push(sql)
    if (sql.includes('FROM users') && sql.includes('deletion_scheduled_at IS NULL')) {
        return { rows: [{ id: 'target-user', name: 'Target User', avatar: null }] }
    }
    if (sql.includes('FROM system_events')) return { rows: [{ id: 731 }] }
    throw new Error(`Unexpected impersonation start query: ${sql}`)
}

mock.module('#db', () => ({ default: query }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'admin-user' }) }))
mock.module('#utils/systemEvent.ts', () => ({
    actorHasHanasandInternalAccess: async () => true,
    recordSystemEvent: async (_req: unknown, event: Record<string, any>) => { systemEvents.push(event) },
    requireAuditReason: (value: unknown, label: string) => {
        const reason = typeof value === 'string' ? value.trim() : ''
        if (reason.length < 10) throw new Error(`${label} must be at least 10 characters.`)
        return reason
    },
}))
mock.module('#utils/support/supportSessionState.ts', () => ({ loadSupportSessionState: async () => supportSession }))

const { startImpersonation } = await import('../src/handlers/impersonation.ts')
const app = Fastify({ logger: false })
app.post('/impersonation/start', startImpersonation)

beforeEach(() => {
    supportSession = null
    systemEvents.length = 0
    queries.length = 0
})

test('invalid start request returns its audited denial receipt without a support session field', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/impersonation/start',
        headers: { 'x-request-id': 'invalid-start-request' },
        payload: { targetId: 'target-user', reason: 'short' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
        error: 'Impersonation reason must be at least 10 characters.',
        detail: {
            schemaVersion: 'support.impersonation.error.v1',
            code: 'invalid_impersonation_request',
            outcome: 'denied',
            requestId: 'invalid-start-request',
            auditEventIds: [731],
            guardrailReceipt: {
                schemaVersion: 'support.impersonation.guardrail_receipt.v1',
                outcome: 'denied',
                blockerCode: 'invalid_impersonation_request',
                auditEventIds: [731],
            },
        },
    })
    expect(response.json().detail).not.toHaveProperty('supportSessionId')
    expect(systemEvents).toHaveLength(1)
    expect(systemEvents[0]).toMatchObject({ actionType: 'impersonation.start', outcome: 'denied', context: { blockerCode: 'invalid_impersonation_request' } })
})

test('support-session scope denial returns the same receipt with its scoped session identity', async () => {
    supportSession = {
        status: 'active',
        actorId: 'admin-user',
        organizationId: 'org-1',
        targetUserId: 'target-user',
        allowedActions: ['impersonation'],
        scope: [],
        expiresAt: '2030-01-01T00:00:00.000Z',
    }
    const response = await app.inject({
        method: 'POST',
        url: '/impersonation/start',
        headers: { 'x-request-id': 'scope-denial-request' },
        payload: {
            targetId: 'target-user',
            organizationId: 'org-1',
            supportSessionId: 'support-session-1',
            reason: 'Customer requested an access investigation.',
            durationMinutes: 30,
            scope: ['read_profile'],
        },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
        error: 'Support session does not include impersonation scope read_profile.',
        detail: {
            code: 'support_session_scope_denied',
            outcome: 'denied',
            requestId: 'scope-denial-request',
            auditEventIds: [731],
            supportSessionId: 'support-session-1',
            guardrailReceipt: {
                outcome: 'denied',
                blockerCode: 'support_session_scope_denied',
                target: { supportSessionId: 'support-session-1' },
                auditEventIds: [731],
            },
        },
    })
    expect(systemEvents).toHaveLength(1)
    expect(systemEvents[0]).toMatchObject({
        actionType: 'impersonation.start',
        outcome: 'denied',
        context: { supportSessionId: 'support-session-1', blockerCode: 'support_session_scope_denied', scope: ['read_profile'] },
    })
    expect(queries).toHaveLength(2)
})
