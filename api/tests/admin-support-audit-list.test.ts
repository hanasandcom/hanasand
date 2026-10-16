import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, run, request, getSystemEvents, getSystemEvent, getSupportAccessRecoveryApprovals } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('admin-support database fake reports unmatched SQL', async () => {
    const unmatchedSql = 'SELECT intentionally_unmatched_admin_support_test_query'

    await expect(run(unmatchedSql)).rejects.toThrow(unmatchedSql)
})

test('support audit routes enforce admin-only access and reject impersonated actors', async () => {
    state.actor = { valid: false, id: '', impersonating: false }
    expect((await request(getSystemEvents)).statusCode).toBe(401)
    expect(state.queries).toHaveLength(0)

    state.actor = { valid: true, id: 'support-admin', impersonating: true }
    expect((await request(getSystemEvents)).statusCode).toBe(401)
    expect(state.queries).toHaveLength(0)

    state.actor = { valid: true, id: 'customer-user', impersonating: false }
    state.internalAccess = false
    const denied = await request(getSystemEvents)
    expect(denied.statusCode).toBe(403)
    expect(denied.body.detail.code).toBe('support_role_required')
    expect((await request(getSupportAccessRecoveryApprovals)).statusCode).toBe(403)
    expect(state.queries).toHaveLength(0)
})

test('audit event filters are parameterized and context secrets are redacted in responses', async () => {
    state.eventRows = [{
        id: 42,
        event_type: 'support.organization.inspect',
        severity: 'warning',
        source: 'system',
        service: 'hanasand-api',
        actor_id: 'support-admin',
        actor_name: 'Support Admin',
        object_type: 'organization',
        object_id: 'org-1',
        target_name: 'Org One',
        organization_id: 'org-1',
        organization_name: 'Org One',
        subject_id: 'org-1',
        request_id: 'request-1',
        outcome: 'success',
        reason: 'Customer requested access inspection',
        context: {
            workflow: 'support.organization',
            targetName: 'Org One',
            supportSessionId: 'real-support-session',
            password: 'secret',
            nested: { apiToken: 'token-secret', safe: 'kept' },
            webhookUrl: 'https://private.example/hook',
        },
        ip: '192.0.2.10',
        user_agent: 'private user agent',
        created_at: '2026-09-20T00:00:00.000Z',
    }]
    const filters = {
        q: 'needle\' OR 1=1 --',
        orgId: 'org-1',
        actionType: 'support.organization.inspect',
        requestId: 'request-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
        supportSessionId: 'session-1',
        workflow: 'support.organization',
        blockerCode: 'none',
        supportReason: 'inspection',
        supportScope: 'organization',
        supportContext: 'case-7',
        source: 'admin',
        service: 'hanasand-api',
        entityType: 'organization',
        severity: 'warning',
        outcome: 'success',
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T00:00:00.000Z',
    }
    const response = await request(getSystemEvents, { query: filters })
    expect(response.statusCode).toBe(200)
    expect(state.queries).toHaveLength(2)
    const query = state.queries[1]
    expect(query.sql).toContain('e.event_type ILIKE')
    expect(query.sql).toContain('e.context->>\'correlationId\' ILIKE')
    expect(query.sql).toContain('e.context->>\'idempotencyKey\' ILIKE')
    expect(query.sql).toContain('e.context->>\'supportSessionId\' ILIKE')
    expect(query.sql).toContain('e.context->>\'workflow\' ILIKE')
    expect(query.sql).toContain('e.context->>\'blockerCode\' ILIKE')
    expect(query.sql).toContain('e.context->>\'supportScope\' ILIKE')
    expect(query.sql).toContain('e.source ILIKE')
    expect(query.sql).toContain('e.service ILIKE')
    expect(query.sql).toContain('e.object_type ILIKE')
    expect(query.sql).toContain('e.outcome =')
    expect(query.sql).not.toContain('needle\' OR 1=1 --')
    expect(query.values).toContain('%needle\' OR 1=1 --%')
    expect(query.values).toContain('%org-1%')
    expect(query.values).toContain('%support.organization.inspect%')
    expect(query.values).toContain('%request-1%')
    expect(query.values).toContain('%admin%')
    expect(query.values).toContain('%hanasand-api%')
    expect(query.values).toContain('%organization%')
    expect(query.values).toContain('%corr-1%')
    expect(query.values).toContain('%idem-1%')
    expect(query.values).toContain('%session-1%')
    expect(query.values).toContain('%case-7%')
    expect(query.values).not.toContain('support.organization.inspect OR 1=1')
    expect(query.values).toEqual([
        '%needle\' OR 1=1 --%', '%org-1%', '%support.organization.inspect%', 'warning',
        '%admin%', '%hanasand-api%', '%organization%', '%request-1%', '%corr-1%',
        '%idem-1%', '%session-1%', '%support.organization%', '%none%', '%inspection%',
        '%organization%', '%case-7%', 'success', '2026-09-01T00:00:00.000Z',
        '2026-09-30T00:00:00.000Z', 201, 0,
    ])

    const event = response.body.events[0]
    expect(event.context).toEqual({
        workflow: 'support.organization',
        targetName: 'Org One',
        supportSessionId: '[redacted]',
        password: '[redacted]',
        nested: { apiToken: '[redacted]', safe: 'kept' },
        webhookUrl: '[redacted]',
    })
    expect(event.detail.timelineEvent.context).toEqual(event.context)
    expect(event.detail.timelineEvent.links.supportSession).toBe('/api/admin/support/sessions/real-support-session')
})

test('audit detail route redacts stored context and records an inspection event', async () => {
    const targetEvent = {
        id: 42,
        event_type: 'support.organization.inspect',
        severity: 'warning',
        source: 'system',
        service: 'hanasand-api',
        actor_id: 'support-admin',
        actor_name: 'Support Admin',
        object_type: 'organization',
        object_id: 'org-1',
        target_name: 'Org One',
        organization_id: 'org-1',
        organization_name: 'Org One',
        subject_id: 'org-1',
        request_id: 'request-1',
        outcome: 'success',
        reason: 'Customer requested access inspection',
        context: { password: 'secret', nested: { privateSourceUrl: 'https://private.example/source' }, safe: 'kept' },
        created_at: '2026-09-20T00:00:00.000Z',
    }
    state.eventRows = [
        { ...targetEvent, id: 43, context: { password: 'wrong audit event' } },
        targetEvent,
    ]
    const response = await request(getSystemEvent, { params: { id: '42' } })
    expect(response.statusCode).toBe(200)
    expect(response.body.event.id).toBe(42)
    const relatedTimelineQuery = state.queries.find(({ sql }) => sql.includes('e.request_id = $2'))
    expect(relatedTimelineQuery?.sql).toContain('e.context,\n            e.ip,\n            e.user_agent,\n            e.created_at')
    expect(response.body.event.context).toEqual({
        password: '[redacted]',
        nested: { privateSourceUrl: '[redacted]' },
        safe: 'kept',
    })
    expect(response.body.detail.timelineEvent.context).toEqual(response.body.event.context)
    expect(state.recordedEvents).toHaveLength(1)
    expect(state.recordedEvents[0]).toMatchObject({
        actionType: 'support.audit_event.inspect',
        actorId: 'support-admin',
        outcome: 'success',
        context: { redactionRequired: true, inspectedEventId: 42 },
    })
})

