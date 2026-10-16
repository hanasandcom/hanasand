import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const lifecycleRows = [
    {
        id: 1,
        session_id: 'active-expired',
        actor_id: 'admin',
        object_id: 'target',
        method: 'POST',
        path: '/api/impersonation/start',
        created_at: '2020-01-01T00:00:00.000Z',
        session_reason: 'Support case',
        session_created_at: '2020-01-01T00:00:00.000Z',
        session_expires_at: '2020-01-01T01:00:00.000Z',
        session_revoked_at: null,
    },
    {
        id: 2,
        session_id: 'stopped',
        actor_id: 'admin',
        object_id: 'target',
        method: 'POST',
        path: '/api/impersonation/start',
        created_at: '2020-01-02T00:00:00.000Z',
        session_reason: 'Support case',
        session_created_at: '2020-01-02T00:00:00.000Z',
        session_expires_at: '2020-01-02T01:00:00.000Z',
        session_revoked_at: '2020-01-02T00:30:00.000Z',
    },
    {
        id: 3,
        session_id: 'stopped',
        actor_id: 'admin',
        object_id: 'target',
        method: 'POST',
        path: '/api/impersonation/stop',
        created_at: '2020-01-02T00:30:00.000Z',
        session_reason: 'Support case',
        session_created_at: '2020-01-02T00:00:00.000Z',
        session_expires_at: '2020-01-02T01:00:00.000Z',
        session_revoked_at: '2020-01-02T00:30:00.000Z',
    },
    {
        id: 4,
        session_id: 'missing-data',
        actor_id: 'admin',
        object_id: 'target',
        method: 'POST',
        path: '/api/impersonation/start',
        created_at: '2020-01-03T00:00:00.000Z',
        session_reason: null,
        session_created_at: null,
        session_expires_at: null,
        session_revoked_at: null,
    },
]
let guardrailRows: Record<string, any>[] = []
let actor: Record<string, any> = { valid: true, id: 'admin' }

mock.module('#db', () => ({
    default: async (sql: string) => {
        if (sql.includes('FROM impersonation_events e')) return { rows: lifecycleRows }
        if (sql.includes('FROM system_events event')) return { rows: guardrailRows }
        throw new Error(`Unexpected query: ${sql}`)
    },
}))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => actor }))
mock.module('#utils/systemEvent.ts', () => ({
    actorHasHanasandInternalAccess: async () => true,
    recordSystemEvent: async () => {},
    requireAuditReason: async () => true,
}))

const { getImpersonationEvents } = await import('../src/handlers/impersonation.ts')
const app = Fastify()
app.get('/impersonation/events', getImpersonationEvents)

test('impersonating actors cannot read the admin event history', async () => {
    const previousActor = actor
    actor = { valid: true, id: 'admin', impersonating: true }

    try {
        const response = await app.inject('/impersonation/events')

        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({ error: 'Unauthorized.' })
    } finally {
        actor = previousActor
    }
})

test('timeline receipts agree on active, stopped, expired, and incomplete lifecycle state', async () => {
    const response = await app.inject('/impersonation/events')
    expect(response.statusCode).toBe(200)

    const { timeline } = response.json()
    expect(timeline.eventIds).toEqual([1, 2, 3, 4])
    expect(timeline.decisionPacket.lifecycle).toMatchObject({
        startEventIds: [1, 2, 4],
        stopEventIds: [3],
        activeSessionIds: ['active-expired', 'missing-data'],
        missingReasonEventIds: [4],
        missingDurationEventIds: [4],
    })
    expect(timeline.caseReview.summary).toMatchObject({
        activeSessionIds: ['active-expired', 'missing-data'],
        stoppedSessionIds: ['stopped'],
        expiredSessionIds: ['active-expired'],
        missingReasonEventIds: [4],
        missingDurationEventIds: [4],
    })
    expect(timeline.lifecycleReceipt).toMatchObject({
        sessionIds: ['active-expired', 'stopped', 'missing-data'],
        lifecycle: {
            startEventIds: [1, 2, 4],
            stopEventIds: [2, 3],
            activeSessionIds: ['active-expired', 'missing-data'],
            stoppedSessionIds: ['stopped'],
            expiredSessionIds: ['active-expired'],
            missingReasonEventIds: [4],
            missingDurationEventIds: [4],
        },
    })
})

test('lifecycle projections use one clock snapshot at an expiry boundary', async () => {
    const originalNow = Date.now
    const originalExpiry = lifecycleRows[0].session_expires_at
    const expiry = originalNow()
    lifecycleRows[0].session_expires_at = new Date(expiry).toISOString()
    let clockReads = 0
    Date.now = () => ++clockReads === 3 ? expiry + 1 : expiry - 1

    try {
        const response = await app.inject('/impersonation/events')
        expect(response.statusCode).toBe(200)

        const { timeline } = response.json()
        expect(timeline.lifecycleReceipt.lifecycle.expiredSessionIds).toEqual([])
        expect(timeline.lifecycleReceipt.lifecycle.expiredSessionIds).toEqual(timeline.caseReview.summary.expiredSessionIds)
    } finally {
        Date.now = originalNow
        lifecycleRows[0].session_expires_at = originalExpiry
    }
})

test('guardrail replay distinguishes support sessions from impersonation session IDs', async () => {
    guardrailRows = [
        { id: 11, event_type: 'impersonation.start', outcome: 'success', subject_id: 'impersonation-11', context: { sessionId: 'impersonation-11', scope: [' read_profile ', '', null, 'read_org'] } },
        { id: 12, event_type: 'impersonation.start', outcome: 'success', subject_id: 'support_session_tagged', context: { sessionId: 'impersonation-12', scope: ['support_debug'] } },
        { id: 13, event_type: 'impersonation.start', outcome: 'success', subject_id: 'impersonation-13', context: { sessionId: 'impersonation-13', supportSessionId: 'support_session_explicit', scope: ['read_profile'] } },
    ]

    const response = await app.inject('/impersonation/events')
    expect(response.statusCode).toBe(200)
    const { timeline } = response.json()
    expect(timeline.guardrailReplay.events.map((event: Record<string, any>) => event.supportSessionId)).toEqual([
        null, 'support_session_tagged', 'support_session_explicit',
    ])
    expect(timeline.guardrailReplay.events[0].links.supportSession).toBeNull()
    expect(timeline.guardrailReplay.supportSessionIds).toEqual(['support_session_tagged', 'support_session_explicit'])
    expect(timeline.caseReview.guardrailEvents.map((event: Record<string, any>) => event.supportSessionId)).toEqual([
        '', 'support_session_tagged', 'support_session_explicit',
    ])
    expect(timeline.guardrailReplay.events.map((event: Record<string, any>) => event.scope)).toEqual([
        ['read_profile', 'read_org'], ['support_debug'], ['read_profile'],
    ])
    expect(timeline.caseReview.guardrailEvents.map((event: Record<string, any>) => event.scope)).toEqual([
        ['read_profile', 'read_org'], ['support_debug'], ['read_profile'],
    ])
})
