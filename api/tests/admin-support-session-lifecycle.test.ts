import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, request, postSupportSession, getSupportSession, postSupportSessionRevoke } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('support session can be created, inspected, then revoked through its audit lifecycle', async () => {
    const created = await request(postSupportSession, {
        body: {
            organizationId: 'org-1',
            reason: 'Investigate a reported account issue',
            requestId: 'session-request-1',
            allowedActions: ['impersonation'],
            scope: ['read_profile'],
            durationMinutes: 30,
        },
    })

    expect(created.statusCode).toBe(201)
    expect(created.body.supportSession).toMatchObject({
        schemaVersion: 'support.scoped_session.v1',
        status: 'active',
        actorId: 'support-admin',
        target: { organizationId: 'org-1', userId: null },
        allowedActions: ['impersonation'],
        scope: ['read_profile'],
        requestId: 'session-request-1',
        auditEventIds: [100],
    })
    const sessionId = created.body.supportSession.id as string

    const inspected = await request(getSupportSession, { params: { sessionId } })
    expect(inspected.statusCode).toBe(200)
    const sessionTimelineQuery = state.queries.find(({ sql }) => sql.includes('e.context->>\'supportSessionId\' = $1'))
    expect(sessionTimelineQuery?.sql).toContain('e.context,\n            e.ip,\n            e.user_agent,\n            e.created_at')
    expect(inspected.body.supportSession).toMatchObject({ id: sessionId, status: 'active', requestId: 'session-request-1' })
    expect(inspected.body.detail.authorization).toBeDefined()
    expect(inspected.body.detail.auditTimeline.eventIds).toContain(100)

    const revoked = await request(postSupportSessionRevoke, {
        params: { sessionId },
        body: { reason: 'Investigation complete', requestId: 'session-revoke-1' },
    })
    expect(revoked.statusCode).toBe(200)
    expect(revoked.body.supportSession).toMatchObject({
        id: sessionId,
        status: 'revoked',
        revokedBy: 'support-admin',
        requestId: 'session-revoke-1',
        auditEventIds: [102],
    })

    const repeatedRevoke = await request(postSupportSessionRevoke, {
        params: { sessionId },
        body: { reason: 'Repeat revoke check', requestId: 'session-revoke-repeat' },
    })
    expect(repeatedRevoke.statusCode).toBe(409)
    expect(repeatedRevoke.body.detail.code).toBe('support_session_revoked')
    expect(state.recordedEvents.at(-1)).toMatchObject({ actionType: 'support.session.revoke', outcome: 'failed', context: { blockerCode: 'support_session_revoked' } })

    const inspectedAfterRevoke = await request(getSupportSession, { params: { sessionId } })
    expect(inspectedAfterRevoke.statusCode).toBe(200)
    expect(inspectedAfterRevoke.body.supportSession).toMatchObject({ id: sessionId, status: 'revoked' })
    expect(state.recordedEvents.filter(event => ['support.session.create', 'support.session.revoke'].includes(String(event.actionType)))).toHaveLength(3)
})

test('support session workflow routes respect the action and scope grants', async () => {
    const created = await request(postSupportSession, {
        body: {
            organizationId: 'org-1',
            reason: 'Investigate a reported account issue',
            requestId: 'session-workflows-1',
            allowedActions: ['access_recovery', 'impersonation', 'invite_resend'],
            scope: ['recovery:deny', 'read_profile', 'invite:resend'],
        },
    })

    expect(created.statusCode).toBe(201)
    const session = created.body.supportSession
    const routes = session.lifecycleReceipt.actionRoutes
    expect(routes).toEqual({
        detail: `/api/admin/support/sessions/${session.id}`,
        revoke: `/api/admin/support/sessions/${session.id}/revoke`,
        audit: `/api/admin/audit-events?supportSession=${encodeURIComponent(session.id)}&source=system&service=hanasand-api`,
        inviteAssistance: null,
        inviteResend: '/api/admin/support/organizations/org-1/invites/:inviteId/actions',
        inviteRevoke: null,
        accessRecovery: null,
        accessRecoveryApproval: '/api/admin/support/access-recovery/:requestId/:decision',
        memberRoleRecovery: null,
        impersonation: '/api/impersonation/start',
    })
    const nextActions = session.lifecycleReceipt.nextActions as Array<{
        name: string
        route: string | null
        available: boolean
        requiredScope: string[]
    }>
    expect(nextActions.find(action => action.name === 'Resend invite')).toMatchObject({
        route: routes.inviteResend,
        available: true,
        requiredScope: ['invite:resend'],
    })
    expect(nextActions.find(action => action.name === 'Open access recovery')).toMatchObject({
        route: null,
        available: false,
        requiredScope: ['recovery:invite'],
    })
    expect(nextActions.find(action => action.name === 'Start scoped impersonation')).toMatchObject({
        route: routes.impersonation,
        available: true,
        requiredScope: ['read_profile'],
    })
})

test('support session inspection uses the latest successful revoke and retains ordered audit IDs', async () => {
    const sessionId = 'support_session_multiple_revokes'
    const expiresAt = '2099-01-01T00:00:00.000Z'
    state.supportSessionEvents.push(
        {
            id: 301, event_type: 'support.session.create', actor_id: 'creator', subject_id: sessionId,
            request_id: 'create-request', reason: 'Review access', outcome: 'success',
            context: { expiresAt }, created_at: '2026-10-16T10:00:00.000Z',
        },
        {
            id: 302, event_type: 'support.session.create', actor_id: 'later-creator', subject_id: sessionId,
            request_id: 'later-create-request', reason: 'Later create must not replace original', outcome: 'success',
            context: { expiresAt }, created_at: '2026-10-16T10:00:30.000Z',
        },
        {
            id: 303, event_type: 'support.session.revoke', actor_id: 'first-revoker', subject_id: sessionId,
            outcome: 'success', created_at: '2026-10-16T10:01:00.000Z',
        },
        {
            id: 304, event_type: 'support.session.revoke', actor_id: 'failed-revoker', subject_id: sessionId,
            outcome: 'failed', created_at: '2026-10-16T10:02:00.000Z',
        },
        {
            id: 305, event_type: 'support.session.revoke', actor_id: 'latest-revoker', subject_id: sessionId,
            outcome: 'success', created_at: '2026-10-16T10:03:00.000Z',
        },
    )

    const inspected = await request(getSupportSession, { params: { sessionId } })

    expect(inspected.statusCode).toBe(200)
    expect(inspected.body.supportSession).toMatchObject({
        id: sessionId,
        actorId: 'creator',
        reason: 'Review access',
        requestId: 'create-request',
        status: 'revoked',
        revokedBy: 'latest-revoker',
        revokedAt: '2026-10-16T10:03:00.000Z',
        auditEventIds: [301, 302, 303, 304, 305],
    })
})

test('expired support session revoke uses the lifecycle status and records a denial', async () => {
    const sessionId = 'support_session_expired'
    state.supportSessionEvents.push({
        id: 99,
        event_type: 'support.session.create',
        actor_id: 'support-admin',
        subject_id: sessionId,
        request_id: 'session-create-expired',
        reason: 'Investigate a reported account issue',
        outcome: 'success',
        context: { expiresAt: '2000-01-01T00:00:00.000Z' },
    })

    const result = await request(postSupportSessionRevoke, {
        params: { sessionId },
        body: { reason: 'Investigation complete', requestId: 'session-revoke-expired' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.detail.code).toBe('support_session_expired')
    expect(result.body.detail.supportSession).toMatchObject({ id: sessionId, status: 'expired' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.session.revoke',
        outcome: 'denied',
        context: { supportSessionId: sessionId, blockerCode: 'support_session_expired' },
    })
    expect(state.supportSessionEvents.filter(event => event.subject_id === sessionId && event.event_type === 'support.session.revoke' && event.outcome === 'success')).toHaveLength(0)
})
