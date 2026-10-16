import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let supportSession: Record<string, any> | null = null
const systemEvents: Array<Record<string, any>> = []
const queries: Array<{ sql: string, values: unknown[] }> = []

const query = async (sql: string, values: unknown[] = []) => {
    queries.push({ sql, values })
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

function expectDeniedEventLookup(requestId: string, entityId: string) {
    expect(queries).toHaveLength(2)
    expect(queries[1].sql).toContain('WHERE request_id = $1')
    expect(queries[1].sql).toContain('AND event_type = $2')
    expect(queries[1].sql).toContain('AND subject_id = $3')
    expect(queries[1].values).toEqual([requestId, 'impersonation.start', entityId])
}

beforeEach(() => {
    supportSession = null
    systemEvents.length = 0
    queries.length = 0
})

test('invalid start request keeps an optional session in its receipt but omits it from the error detail', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/impersonation/start',
        headers: { 'x-request-id': 'invalid-start-request' },
        payload: { targetId: 'target-user', supportSessionId: 'support-session-invalid', reason: 'short' },
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
                actorId: 'admin-user',
                target: { type: 'user', id: 'target-user', organizationId: null, supportSessionId: 'support-session-invalid' },
                outcome: 'denied',
                blockerCode: 'invalid_impersonation_request',
                auditEventIds: [731],
            },
        },
    })
    expect(response.json().detail).not.toHaveProperty('supportSessionId')
    expect(systemEvents).toHaveLength(1)
    expect(systemEvents[0]).toMatchObject({
        actionType: 'impersonation.start', actorId: 'admin-user', targetType: 'user', targetId: 'target-user',
        organizationId: null, entityId: 'support-session-invalid', severity: 'warning', outcome: 'denied',
        reason: 'short', requestId: 'invalid-start-request',
        context: {
            schemaVersion: 'support.impersonation.denied.v1', requestId: 'invalid-start-request',
            targetUserId: 'target-user', organizationId: null, supportSessionId: 'support-session-invalid',
            blockerCode: 'invalid_impersonation_request', message: 'Impersonation reason must be at least 10 characters.',
            scope: [], durationMinutes: null, expiresAt: null, outcome: 'denied',
            noSilentImpersonation: true, redactionRequired: true,
        },
    })
    expect(queries[0].values).toEqual(['target-user'])
    expectDeniedEventLookup('invalid-start-request', 'support-session-invalid')
})

test('invalid start request without a session omits it from the receipt and correlates audit to the target', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/impersonation/start',
        headers: { 'x-request-id': 'invalid-start-no-session' },
        payload: { targetId: 'target-user', reason: 'short' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
        detail: {
            schemaVersion: 'support.impersonation.error.v1',
            code: 'invalid_impersonation_request',
            requestId: 'invalid-start-no-session',
            guardrailReceipt: {
                schemaVersion: 'support.impersonation.guardrail_receipt.v1',
                actorId: 'admin-user',
                target: { type: 'user', id: 'target-user', organizationId: null, supportSessionId: null },
            },
        },
    })
    expect(response.json().detail).not.toHaveProperty('supportSessionId')
    expect(systemEvents).toHaveLength(1)
    expect(systemEvents[0]).toMatchObject({
        actionType: 'impersonation.start', actorId: 'admin-user', targetType: 'user', targetId: 'target-user',
        organizationId: null, entityId: 'target-user', severity: 'warning', outcome: 'denied',
        reason: 'short', requestId: 'invalid-start-no-session',
        context: {
            schemaVersion: 'support.impersonation.denied.v1', requestId: 'invalid-start-no-session',
            targetUserId: 'target-user', organizationId: null, supportSessionId: null,
            blockerCode: 'invalid_impersonation_request', outcome: 'denied',
        },
    })
    expect(queries[0].values).toEqual(['target-user'])
    expectDeniedEventLookup('invalid-start-no-session', 'target-user')
})

test('unsupported impersonation scope reports the first normalized invalid item', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/impersonation/start',
        headers: { 'x-request-id': 'invalid-scope-request' },
        payload: {
            targetId: 'target-user',
            reason: 'Customer requested an access investigation.',
            durationMinutes: 30,
            scope: [' read_profile ', null, 'read_org'],
        },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
        error: 'Unsupported impersonation scope: blank.',
        detail: { code: 'invalid_impersonation_request', outcome: 'denied' },
    })
    expect(systemEvents[0].context).toMatchObject({ blockerCode: 'invalid_impersonation_request', scope: [] })
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
            schemaVersion: 'support.impersonation.error.v1',
            code: 'support_session_scope_denied',
            outcome: 'denied',
            requestId: 'scope-denial-request',
            auditEventIds: [731],
            supportSessionId: 'support-session-1',
            guardrailReceipt: {
                schemaVersion: 'support.impersonation.guardrail_receipt.v1',
                actorId: 'admin-user',
                outcome: 'denied',
                blockerCode: 'support_session_scope_denied',
                target: { type: 'user', id: 'target-user', organizationId: 'org-1', supportSessionId: 'support-session-1' },
                auditEventIds: [731],
            },
        },
    })
    expect(systemEvents).toHaveLength(1)
    expect(systemEvents[0]).toMatchObject({
        actionType: 'impersonation.start', actorId: 'admin-user', targetType: 'user', targetId: 'target-user',
        organizationId: 'org-1', entityId: 'support-session-1', severity: 'warning', outcome: 'denied',
        reason: 'Customer requested an access investigation.', requestId: 'scope-denial-request',
        context: {
            schemaVersion: 'support.impersonation.denied.v1', requestId: 'scope-denial-request',
            targetUserId: 'target-user', organizationId: 'org-1', supportSessionId: 'support-session-1',
            blockerCode: 'support_session_scope_denied', message: 'Support session does not include impersonation scope read_profile.',
            scope: ['read_profile'], durationMinutes: 30, expiresAt: expect.any(String), outcome: 'denied',
            noSilentImpersonation: true, redactionRequired: true,
        },
    })
    expect(queries[0].values).toEqual(['target-user'])
    expectDeniedEventLookup('scope-denial-request', 'support-session-1')
})
