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

mock.module('#db', () => ({
    default: async (sql: string) => {
        if (sql.includes('FROM impersonation_events e')) return { rows: lifecycleRows }
        if (sql.includes('FROM system_events event')) return { rows: [] }
        throw new Error(`Unexpected query: ${sql}`)
    },
}))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'admin' }) }))
mock.module('#utils/systemEvent.ts', () => ({
    actorHasHanasandInternalAccess: async () => true,
    recordSystemEvent: async () => {},
    requireAuditReason: async () => true,
}))

const { getImpersonationEvents } = await import('../src/handlers/impersonation.ts')
const app = Fastify()
app.get('/impersonation/events', getImpersonationEvents)

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
