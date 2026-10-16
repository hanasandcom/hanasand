import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, request, getSystemEvent, getSupportReadiness } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('audit detail and support timeline share redacted evidence and links', async () => {
    state.eventRows = [{
        id: 44,
        event_type: 'support.organization.member_role_recovery',
        severity: 'warning',
        source: 'admin',
        service: 'hanasand-api',
        actor_id: 'support-admin',
        actor_name: 'Support Admin',
        object_type: 'organization',
        object_id: 'org-1',
        target_name: 'Org One',
        organization_id: 'org-1',
        organization_name: 'Org One',
        subject_id: 'member-1',
        request_id: 'request-44',
        outcome: 'success',
        reason: 'Restore requested member access',
        context: {
            workflow: 'support.organization',
            supportSessionId: 'real-support-session',
            before: { role: 'viewer' },
            after: { role: 'editor' },
            password: 'secret',
        },
        created_at: '2026-10-16T00:00:00.000Z',
    }]

    const detailResponse = await request(getSystemEvent, { params: { id: '44' } })
    expect(detailResponse.statusCode).toBe(200)
    const detail = detailResponse.body.event.detail
    expect(detail).toMatchObject({
        before: { role: 'viewer' },
        after: { role: 'editor' },
        context: {
            supportSessionId: '[redacted]',
            password: '[redacted]',
        },
        actionEvidence: { supportSessionId: 'real-support-session', beforeAfterPresent: { before: true, after: true } },
    })
    expect(detail.timelineEvent).toMatchObject({
        target: { name: 'Org One' },
        before: { role: 'viewer' },
        after: { role: 'editor' },
        context: detail.context,
        actionEvidence: detail.actionEvidence,
        links: {
            detail: '/api/admin/audit-events/44',
            request: '/api/admin/audit-events?request=request-44',
            entity: '/api/admin/audit-events?entity=member-1',
            supportSession: '/api/admin/support/sessions/real-support-session',
        },
    })

    const timelineResponse = await request(getSupportReadiness, { query: { org: 'org-1' } })
    expect(timelineResponse.statusCode).toBe(200)
    const [timelineEvent] = timelineResponse.body.filteredTimeline.events
    expect(timelineEvent).toMatchObject({
        id: 44,
        action: 'support.organization.member_role_recovery',
        entityId: 'member-1',
        before: detail.before,
        after: detail.after,
        context: detail.context,
        actionEvidence: {
            schemaVersion: 'support.audit.action_evidence.v1',
            supportSessionId: 'real-support-session',
            beforeAfterPresent: { before: true, after: true },
        },
        links: detail.timelineEvent.links,
    })
})

test('audit detail links only explicit or tagged support sessions', async () => {
    state.eventRows = [{
        id: 43, event_type: 'impersonation.start', severity: 'warning', source: 'admin', service: 'hanasand-api',
        actor_id: 'support-admin', object_type: 'user', object_id: 'target-user', organization_id: 'org-1',
        subject_id: 'support_session_tagged', request_id: 'request-tagged', outcome: 'success', reason: 'Support case',
        context: { sessionId: 'impersonation-session' }, created_at: '2026-10-16T00:00:00.000Z',
    }]
    const tagged = await request(getSystemEvent, { params: { id: '43' } })
    expect(tagged.body.event.detail.timelineEvent.links.supportSession).toBe('/api/admin/support/sessions/support_session_tagged')
    expect(tagged.body.detail.filterContract.filters.supportSession).toBe('support_session_tagged')

    state.eventRows = [{
        ...state.eventRows[0], subject_id: 'target-user', context: { supportSessionId: 'real-support-session' },
    }]
    const explicit = await request(getSystemEvent, { params: { id: '43' } })
    expect(explicit.body.event.context.supportSessionId).toBe('[redacted]')
    expect(explicit.body.event.detail.timelineEvent.links.supportSession).toBe('/api/admin/support/sessions/real-support-session')
    expect(explicit.body.event.detail.actionEvidence.supportSessionId).toBe('real-support-session')
    expect(explicit.body.detail.filterContract.filters.supportSession).toBe('real-support-session')

    state.eventRows = [{
        ...state.eventRows[0], subject_id: 'impersonation-session', context: { sessionId: 'impersonation-session' },
    }]
    const impersonationOnly = await request(getSystemEvent, { params: { id: '43' } })
    expect(impersonationOnly.body.event.detail.timelineEvent.links.supportSession).toBeNull()
    expect(impersonationOnly.body.detail.filterContract.filters.supportSession).toBe('')
})

