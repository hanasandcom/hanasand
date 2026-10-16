import { beforeEach, expect, mock, test } from 'bun:test'
import { resetAdminSupportDatabaseFixture, run, state } from './fixtures/admin-support-routes-db.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { uniqueTimelineValues } from '../src/utils/support/inspectionPackets.ts'

function accessRecoveryApprovalFixture(requestId: string) {
    return {
        request_id: requestId, organization_id: 'org-1', invite_id: 'invite-1', target_user_id: 'user-1',
        requested_by: 'requester', requested_reason: 'Restore account access', request_context: '', approval_required: true,
        status: 'pending', approved_by: null, approved_at: null, denied_by: null, denied_at: null, decision_reason: null,
        outcome: 'success', expires_at: '2026-11-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z', email: 'member@example.com', role: 'reader', invite_status: 'revoked', organization_name: 'Org',
    }
}

mock.module('../src/utils/db.ts', () => ({ default: run, queryOnce: run, identityQueryOnce: run, withTransaction: async (work: (query: typeof run) => Promise<unknown>) => work(run), closeDatabase: async () => {} }))
const systemEventUtils = await import('../src/utils/systemEvent.ts')
const identityDataWrites = await import('../src/utils/db/identityDataWrites.ts')
const organizationInviteUpsertCalls: Array<Record<string, unknown>> = []
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => state.actor }))
mock.module('../src/utils/systemEvent.ts', () => ({
    ...systemEventUtils,
    actorHasHanasandInternalAccess: async () => state.internalAccess,
    recordSystemEvent: async (_req: unknown, event: Record<string, unknown>) => {
        state.recordedEvents.push(event)
        if (['support.session.create', 'support.session.revoke', 'support.session.inspect'].includes(String(event.actionType))) {
            state.supportSessionEvents.push({
                id: state.nextSupportEventId++,
                event_type: event.actionType,
                severity: event.severity,
                source: 'admin',
                service: 'hanasand-api',
                actor_id: event.actorId,
                object_type: event.targetType,
                object_id: event.targetId,
                organization_id: event.organizationId,
                subject_id: event.entityId,
                request_id: event.requestId,
                outcome: event.outcome,
                reason: event.reason,
                context: event.context,
                created_at: new Date().toISOString(),
            })
        }
    },
}))
mock.module('../src/utils/db/identityDataWrites.ts', () => ({
    upsertAdminAccessRecoveryApproval: async () => { state.supportRecoveryApprovalWrites += 1 },
    upsertOrganizationInvite: async (input: Record<string, unknown>) => {
        organizationInviteUpsertCalls.push(input)
        return state.supportRecoveryInviteUpsert
    },
    updateOrganizationInviteAction: async (input: Record<string, unknown>) => {
        state.inviteActionWrites += 1
        state.inviteActionInputs.push(input)
        return state.supportRecoveryInviteResult
    },
    updateActiveOrganizationMemberRole: identityDataWrites.updateActiveOrganizationMemberRole,
}))

const {
    getSystemEvents,
    getSystemEvent,
    getSupportAccessRecoveryApprovals,
    getSupportInspection,
    getSupportReadiness,
    getSupportOrganization,
    getSupportUser,
    getSupportOrganizationInvite,
    getSupportOrganizationMember,
    postSupportOrganizationInvite,
    postSupportOrganizationInviteAction,
    postSupportOrganizationMemberRoleRecovery,
    postSupportSession,
    getSupportSession,
    postSupportSessionRevoke,
    postSupportAccessRecovery,
    postSupportAccessRecoveryApprove,
    postSupportAccessRecoveryDeny,
} = await import('../src/handlers/adminSupport.ts')

function reply() {
    return {
        statusCode: 200,
        body: undefined as any,
        header() { return this },
        status(code: number) { this.statusCode = code; return this },
        send(body: unknown) { this.body = body; return this },
    }
}

async function request(handler: (req: any, res: any) => unknown, input: {
    query?: Record<string, string>, params?: Record<string, string>, body?: Record<string, unknown>, headers?: Record<string, string>
} = {}) {
    const result = reply()
    await handler({ query: input.query ?? {}, params: input.params ?? {}, headers: input.headers ?? {}, body: input.body ?? {} } as FastifyRequest, result as unknown as FastifyReply)
    return result
}

function activeSupportOrganizationFixture() {
    return { id: 'org-1', name: 'Org', slug: 'org', status: 'active' }
}

function supportInviteInspectionFixture() {
    return {
        id: 'invite-1', organization_id: 'org-1', organization_name: 'Org', organization_slug: 'org',
        email: 'member@example.com', role: 'reader', status: 'pending', invited_by: 'owner-1',
        expires_at: '2026-11-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        accepted_at: null, accepted_by: null, revoked_at: null,
    }
}

function supportMemberInspectionFixture() {
    return {
        organization_id: 'org-1', organization_name: 'Org', organization_slug: 'org', user_id: 'member-1',
        name: 'Member', avatar: null, active: true, deactivated_at: null, deletion_scheduled_at: null,
        role: 'editor', status: 'active', invited_by: 'owner-1', joined_at: '2026-10-01T00:00:00.000Z',
        created_at: '2026-10-01T00:00:00.000Z',
    }
}

function supportInspectionAuditFixture(entityId: string) {
    return {
        id: 71, event_type: 'support.organization.inspect', severity: 'info', source: 'admin', service: 'hanasand-api',
        actor_id: 'support-admin', actor_name: 'Support Admin', object_type: 'organization', object_id: entityId,
        organization_id: 'org-1', organization_name: 'Org', subject_id: entityId, request_id: 'prior-request',
        outcome: 'success', reason: 'Inspection event', context: {}, created_at: '2026-10-16T00:00:00.000Z',
    }
}

function expectInspectionAuditQuery(entityId: string, targetPredicates: string[]) {
    const auditQuery = state.queries.find(({ sql }) => sql.includes('FROM system_events event') && sql.includes('event.organization_id = $1'))
    expect(auditQuery).toBeDefined()
    expect(auditQuery?.sql).toContain('event.organization_id = $1')
    expect(auditQuery?.sql).toContain('event.subject_id = $2')
    for (const predicate of targetPredicates) expect(auditQuery?.sql).toContain(predicate)
    expect(auditQuery?.values).toEqual(['org-1', entityId])
}

beforeEach(() => {
    resetAdminSupportDatabaseFixture()
    organizationInviteUpsertCalls.length = 0
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

test('audit and support inspection filters retain separate validation contracts', async () => {
    const auditUnsupported = await request(getSystemEvents, { query: { unexpected: 'x' } })
    expect(auditUnsupported.statusCode).toBe(400)
    expect(auditUnsupported.body.detail).toMatchObject({ code: 'unsupported_audit_filter' })
    const inspectionUnsupported = await request(getSupportInspection, { query: { org: 'org-1', unexpected: 'x' } })
    expect(inspectionUnsupported.statusCode).toBe(400)
    expect(inspectionUnsupported.body.detail).toMatchObject({ code: 'unsupported_support_filter' })

    const auditInvalidSeverity = await request(getSystemEvents, { query: { severity: 'urgent' } })
    expect(auditInvalidSeverity.statusCode).toBe(400)
    expect(auditInvalidSeverity.body.detail).toMatchObject({ code: 'invalid_audit_filter', filter: 'severity' })

    const inspectionInvalidSeverity = await request(getSupportInspection, { query: { org: 'org-1', severity: 'urgent' } })
    expect(inspectionInvalidSeverity.statusCode).toBe(400)
    expect(inspectionInvalidSeverity.body.detail).toMatchObject({ code: 'invalid_support_filter', filter: 'severity' })

    const auditInvalidDate = await request(getSystemEvents, { query: { from: 'not-a-date' } })
    expect(auditInvalidDate.body).toMatchObject({ error: 'Invalid audit start time.' })
    const inspectionInvalidDate = await request(getSupportInspection, { query: { org: 'org-1', from: 'not-a-date' } })
    expect(inspectionInvalidDate.body).toMatchObject({ error: 'Invalid audit timeline start time.' })

    const auditInvalidLimit = await request(getSystemEvents, { query: { limit: '' } })
    expect(auditInvalidLimit.body).toMatchObject({ error: 'Audit limit must be a positive number.' })
    const inspectionInvalidLimit = await request(getSupportInspection, { query: { org: 'org-1', limit: '' } })
    expect(inspectionInvalidLimit.body).toMatchObject({ error: 'Support inspection limit must be a positive number.' })

    const overbroadInspection = await request(getSupportInspection, { query: { action: 'support.inspect' } })
    expect(overbroadInspection.statusCode).toBe(400)
    expect(overbroadInspection.body.detail.code).toBe('overbroad_support_timeline_filter')
    const invalidInspectionWithAction = await request(getSupportInspection, { query: { action: 'support.inspect', severity: 'urgent' } })
    expect(invalidInspectionWithAction.body.detail.code).toBe('invalid_support_filter')
    expect(state.queries).toHaveLength(0)
})

test('system audit allows an unfiltered query while support inspection requires a target', async () => {
    const audit = await request(getSystemEvents, { query: {} })
    expect(audit.statusCode).toBe(200)
    expect(state.queries).toHaveLength(2)

    state.queries.length = 0
    const inspection = await request(getSupportInspection, { query: {} })
    expect(inspection.statusCode).toBe(400)
    expect(inspection.body.detail.code).toBe('missing_support_target')
    expect(state.queries).toHaveLength(0)
})

test('support inspection returns preparation validation errors before database reads', async () => {
    const response = await request(getSupportInspection, {
        query: {
            org: 'org-1',
            prepareAction: 'impersonation',
            reason: 'Case review',
            scope: 'read_profile',
            duration_minutes: '4',
        },
    })
    expect(response.statusCode).toBe(400)
    expect(response.body.detail.code).toBe('invalid_duration')
    expect(state.queries).toHaveLength(0)
})

test('support readiness preserves its default audit filters and limit cap', async () => {
    const response = await request(getSupportReadiness, { query: { org: 'org-1', limit: '80' } })
    expect(response.statusCode).toBe(200)
    expect(response.body.filteredTimeline.filter).toMatchObject({
        action: 'support', source: 'system', service: 'hanasand-api', limit: 50,
    })
    const auditQuery = state.queries.find(query => query.sql.includes('FROM system_events event'))
    expect(auditQuery?.values).toEqual(['%org-1%', '%support%', '%system%', '%hanasand-api%', 50])
})

test('support readiness applies shared audit filters with inspection aliases and bindings', async () => {
    const response = await request(getSupportReadiness, { query: {
        org: 'org-1', request: 'request-1', entityType: 'organization', supportSession: 'session-1',
        workflow: 'support.organization', action: 'support.inspect', severity: 'warning', outcome: 'success',
        source: 'admin', service: 'hanasand-api', blocker: 'none', reason: 'case review', scope: 'read_profile',
        context: 'case-7', from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T00:00:00.000Z',
    } })
    expect(response.statusCode).toBe(200)
    const auditQuery = state.queries.find(query => query.sql.includes('FROM system_events event'))
    expect(auditQuery?.sql).toContain('event.organization_id ILIKE')
    for (const predicate of [
        'event.request_id ILIKE', 'event.object_type ILIKE', 'event.subject_id ILIKE',
        'event.context->>\'workflow\' ILIKE', 'event.event_type ILIKE', 'event.severity =',
        'event.outcome =', 'event.source ILIKE', 'event.service ILIKE', 'event.context->>\'blockerCode\' ILIKE',
        'event.reason ILIKE', 'event.context->>\'supportScope\' ILIKE', 'event.context::text ILIKE',
        'event.created_at >=', 'event.created_at <=',
    ]) expect(auditQuery?.sql).toContain(predicate)
    expect(auditQuery?.values).toEqual([
        '%org-1%', '%request-1%', '%session-1%', '%support.organization%', '%organization%',
        '%support.inspect%', 'warning', 'success', '%admin%', '%hanasand-api%', '%none%',
        '%case review%', '%read_profile%', '%case-7%', '2026-09-01T00:00:00.000Z',
        '2026-09-30T00:00:00.000Z', 25,
    ])
})

test('support inspection keeps organization member and pending-invite counts in its response', async () => {
    state.supportOrganization = {
        id: 'org-1', name: 'Org', slug: 'org', status: 'active',
        member_count: 3, pending_invite_count: 2,
    }

    const response = await request(getSupportInspection, { query: { org: 'org-1' } })

    expect(response.statusCode).toBe(200)
    expect(response.body.inspection.organizations).toHaveLength(1)
    expect(response.body.inspection.organizations[0]).toMatchObject({
        id: 'org-1',
        memberCount: 3,
        pendingInviteCount: 2,
    })
    const inspection = response.body.inspection
    for (const proof of [
        'searchProof',
        'auditFilterCoverage',
        'actionAuditContract',
        'enterpriseReadiness',
        'negativeCaseMatrix',
        'approvalDecisionPacket',
        'receiptReplayPacket',
        'sessionReplayReceipt',
        'replayExportPacket',
    ]) {
        expect(inspection[proof]).toBeDefined()
        expect(inspection.filteredTimeline[proof]).toEqual(inspection[proof])
    }

    const detail = await request(getSupportOrganization, { params: { id: 'org-1' } })
    expect(detail.statusCode).toBe(200)
    expect(detail.body.organization).toMatchObject({
        id: 'org-1',
        memberCount: 3,
        pendingInviteCount: 2,
    })
})

test('organization and user inspections keep shared fields and target-specific contracts', async () => {
    state.supportOrganization = {
        id: 'org-1', name: 'Org', slug: 'org', status: 'active',
        member_count: 3, pending_invite_count: 2,
    }
    state.supportUser = {
        id: 'user-1', name: 'User One', avatar: null, email: 'member@example.com', active: true, reserved: false,
        deactivated_at: null, deactivated_by: null, deletion_requested_at: null, deletion_scheduled_at: null,
    }

    const organizationResponse = await request(getSupportOrganization, { params: { id: 'org-1' } })
    const userResponse = await request(getSupportUser, { params: { id: 'user-1' } })

    expect(organizationResponse.statusCode).toBe(200)
    expect(userResponse.statusCode).toBe(200)
    const organization = organizationResponse.body
    const user = userResponse.body
    const sharedFields = [
        'authorization', 'accessStatus', 'accessRecoveryPlan', 'inspectionReceipt',
        'actionHistoryReceipt', 'actionHistoryExport', 'caseAccessReadiness', 'caseHandoff',
        'supportActivityRollup', 'recentAuditEvents', 'recentAuditTimeline', 'copyText',
    ]
    for (const field of sharedFields) {
        expect(Object.hasOwn(organization, field)).toBe(true)
        expect(Object.hasOwn(user, field)).toBe(true)
    }

    expect(organization).toMatchObject({
        organization: { id: 'org-1' },
        inspectionReceipt: { schemaVersion: 'support.organization.inspection_receipt.v1' },
        caseAccessReadiness: { schemaVersion: 'support.case_access_readiness.v1' },
        caseHandoff: { schemaVersion: 'support.organization.case_handoff.v1' },
        supportActivityRollup: { schemaVersion: 'support.organization.activity_rollup.v1' },
        members: [],
        invites: [],
        watchlistItems: [],
        webhookDestinations: [],
        recentAuditEvents: [],
    })
    expect(organization.copyText).toBe([
        'Support organization inspection org-1',
        'Authorization: support role',
        `Access status: ${organization.accessStatus.overall}`,
        'Members: 0',
        'Pending invites: 0',
        'Audit events: none',
    ].join('\n'))

    expect(user).toMatchObject({
        user: { id: 'user-1', name: 'User One' },
        inspectionReceipt: { schemaVersion: 'support.user.inspection_receipt.v1' },
        caseAccessReadiness: { schemaVersion: 'support.user_case_access_readiness.v1' },
        caseHandoff: { schemaVersion: 'support.user.case_handoff.v1' },
        supportActivityRollup: { schemaVersion: 'support.user.activity_rollup.v1' },
        memberships: [],
        pendingInvites: [],
        approvalRequests: [],
        recentAuditEvents: [],
    })
    expect(user.copyText).toBe([
        'Support user inspection user-1',
        'Authorization: support role',
        `Access status: ${user.accessStatus.overall}`,
        'Memberships: 0',
        'Pending invites: 0',
        'Audit events: none',
    ].join('\n'))
    for (const subject of [organization, user]) {
        expect(subject.caseAccessReadiness.recoveryState).toEqual({
            accessStatus: subject.accessStatus.overall || null,
            recoveryAvailable: Boolean(subject.accessRecoveryPlan.available || subject.accessRecoveryPlan.items?.length),
            blockers: uniqueTimelineValues([
                ...(Array.isArray(subject.accessStatus.blockers) ? subject.accessStatus.blockers : []),
                ...(Array.isArray(subject.accessRecoveryPlan.blockers) ? subject.accessRecoveryPlan.blockers : []),
            ]),
        })
    }
    expect(organization.recentAuditEvents).toBe(organization.recentAuditTimeline.events)
    expect(user.recentAuditEvents).toBe(user.recentAuditTimeline.events)
    expect(organization).not.toHaveProperty('user')
    expect(user).not.toHaveProperty('organization')
})

test('user inspection finds pending organization invites by the user email', async () => {
    state.supportUser = {
        id: 'user-1', name: 'User One', avatar: null, email: 'member@example.com', active: true, reserved: false,
        deactivated_at: null, deactivated_by: null, deletion_requested_at: null, deletion_scheduled_at: null,
    }
    state.supportUserInvites = [supportInviteInspectionFixture()]

    const response = await request(getSupportUser, { params: { id: 'user-1' } })

    expect(response.statusCode).toBe(200)
    expect(response.body.pendingInvites).toMatchObject([{ id: 'invite-1', email: 'member@example.com' }])
    expect(response.body.copyText).toContain('Pending invites: 1')
    const inviteQuery = state.queries.find(({ sql }) => sql.includes('lower(organization_invites.email) = lower($1)'))
    expect(inviteQuery?.values).toEqual(['member@example.com'])
})

test('organization and user activity rollups share the filtered audit summary', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportUser = {
        id: 'user-1', name: 'User One', avatar: null, active: true, reserved: false,
        deactivated_at: null, deactivated_by: null, deletion_requested_at: null, deletion_scheduled_at: null,
    }
    const event = (id: number | string, event_type: string, request_id: string | null, outcome: string, context: Record<string, unknown> = {}) => ({
        id, event_type, severity: 'notice', source: 'admin', service: 'hanasand-api', actor_id: 'support-admin',
        object_type: 'organization', object_id: 'org-1', organization_id: 'org-1', subject_id: `entity-${id}`,
        request_id, outcome, reason: 'Support audit reason', context, created_at: '2026-10-16T00:00:00.000Z',
    })
    state.eventRows = [
        event(71, 'support.organization.invite_assist', 'rollup-request-1', 'denied', {
            scope: ['invite:create'], expiresAt: '2026-11-01T00:00:00.000Z',
            blockerCode: 'invite_guard', blocker: 'manual_block',
        }),
        event(72, 'support.session.inspect', 'rollup-request-2', 'success'),
        event('not-numeric', 'support.session.inspect', 'rollup-request-2', 'success'),
        event(73, 'organization.member.role_updated', 'other-request', 'denied'),
    ]

    const organizationResponse = await request(getSupportOrganization, { params: { id: 'org-1' } })
    const userResponse = await request(getSupportUser, { params: { id: 'user-1' } })
    expect(organizationResponse.statusCode).toBe(200)
    expect(userResponse.statusCode).toBe(200)
    const organizationRollup = organizationResponse.body.supportActivityRollup
    const userRollup = userResponse.body.supportActivityRollup
    expect(Object.keys(organizationRollup)).toEqual([
        'schemaVersion', 'generatedAt', 'organizationId', 'requestId', 'eventCount', 'eventIds', 'actionCounts',
        'outcomes', 'severities', 'requestIds', 'actorIds', 'targetIds', 'blockerCodes', 'links', 'guardrails',
        'redacted', 'copyText',
    ])
    expect(Object.keys(userRollup)).toEqual([
        'schemaVersion', 'generatedAt', 'userId', 'organizationIds', 'requestId', 'eventCount', 'eventIds',
        'actionCounts', 'outcomes', 'requestIds', 'organizationTimelineLinks', 'links', 'guardrails', 'blockerCodes',
        'redacted', 'copyText',
    ])
    const sharedSummary = (rollup: Record<string, any>) => ({
        eventCount: rollup.eventCount,
        eventIds: rollup.eventIds,
        blockerCodes: rollup.blockerCodes,
        outcomes: rollup.outcomes,
        requestIds: rollup.requestIds,
    })
    expect(sharedSummary(organizationRollup)).toEqual({
        eventCount: 3,
        eventIds: [71, 72],
        blockerCodes: ['redaction_required', 'invite_guard', 'manual_block'],
        outcomes: ['denied', 'success'],
        requestIds: ['rollup-request-1', 'rollup-request-2'],
    })
    expect(sharedSummary(userRollup)).toEqual(sharedSummary(organizationRollup))
    expect(organizationRollup.actionCounts).toEqual({
        inviteAssistance: 1, accessRecovery: 0, memberRoleRecovery: 0, impersonation: 0, supportSessions: 2,
    })
    expect(userRollup.actionCounts).toEqual({
        inspections: 2, inviteAssistance: 1, accessRecovery: 0, memberRoleRecovery: 0, impersonation: 0,
    })
    expect(organizationRollup.severities).toEqual(['notice'])
    expect(userRollup).not.toHaveProperty('severities')
})

test('support invite inspection retains its organization-scoped audit and response contract', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionInvite = supportInviteInspectionFixture()
    state.supportInspectionAuditRows = [supportInspectionAuditFixture('invite-1')]

    const response = await request(getSupportOrganizationInvite, { params: { id: 'org-1', inviteId: 'invite-1' } })

    expect(response.statusCode).toBe(200)
    expect(response.body.invite).toMatchObject({ id: 'invite-1', organizationId: 'org-1', email: 'member@example.com' })
    expect(response.body.inviteInspection).toMatchObject({
        schemaVersion: 'support.invite_inspection.v1',
        organization: { id: 'org-1' },
        invite: { id: 'invite-1', email: 'member@example.com' },
        snapshot: { id: 'invite-1', status: 'pending' },
        authorization: {
            requested: { organizationId: 'org-1', entityId: 'invite-1' },
            effective: { organizationId: 'org-1', email: 'member@example.com', entityId: 'invite-1' },
        },
        caseHandoff: {
            schemaVersion: 'support.invite.case_handoff.v1',
            inviteId: 'invite-1', targetEmail: 'member@example.com',
            evidence: { inviteStatus: 'pending', inviteRole: 'reader', auditEventIds: [71] },
            inviteActions: {
                resend: { requiredScope: 'invite:resend', reasonRequired: true, idempotencyRequired: true },
                revoke: { requiredScope: 'invite:revoke', reasonRequired: true, idempotencyRequired: true },
            },
            safeHandoff: { noLiveAccessGrant: true, noSilentMembershipMutation: true, noCrossOrgLeakage: true, redactionRequired: true },
        },
        auditEventIds: [71],
        auditTimeline: { eventIds: [71] },
        links: {
            action: '/api/admin/support/organizations/org-1/invites/invite-1/actions',
            accessRecovery: '/api/admin/support/organizations/org-1/access-recovery',
            audit: '/api/admin/audit-events?org=org-1&entity=invite-1&entityType=invite',
        },
        noMutation: true,
        redacted: true,
    })
    expectInspectionAuditQuery('invite-1', [
        'event.context->>\'inviteId\' = $2',
        'event.context->\'inviteIds\' ? $2',
    ])
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite.inspect', targetType: 'invite', targetId: 'member@example.com',
        organizationId: 'org-1', entityId: 'invite-1', outcome: 'success',
        context: { inviteId: 'invite-1', email: 'member@example.com', status: 'pending', role: 'reader' },
    })
})

test('support member inspection retains its organization-scoped audit and response contract', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionMember = supportMemberInspectionFixture()
    state.supportInspectionAuditRows = [supportInspectionAuditFixture('member-1')]

    const response = await request(getSupportOrganizationMember, { params: { id: 'org-1', userId: 'member-1' } })

    expect(response.statusCode).toBe(200)
    expect(response.body.member).toMatchObject({ organizationId: 'org-1', userId: 'member-1', role: 'editor' })
    expect(response.body.memberInspection).toMatchObject({
        schemaVersion: 'support.member_inspection.v1',
        organization: { id: 'org-1' },
        member: { organizationId: 'org-1', userId: 'member-1', role: 'editor' },
        snapshot: { organizationId: 'org-1', userId: 'member-1', role: 'editor', status: 'active', active: true },
        authorization: {
            requested: { organizationId: 'org-1', userId: 'member-1', entityId: 'member-1' },
            effective: { organizationId: 'org-1', userId: 'member-1', entityId: 'member-1' },
        },
        caseHandoff: {
            schemaVersion: 'support.member.case_handoff.v1',
            userId: 'member-1',
            evidence: { role: 'editor', status: 'active', active: true, auditEventIds: [71] },
            recovery: { roleRecoveryAvailable: true },
            memberActions: {
                roleRecovery: { requiredScope: 'member:role_recovery', reasonRequired: true, idempotencyRequired: true },
                inspectUser: '/api/admin/support/users/member-1',
            },
            safeHandoff: { noLiveAccessGrant: true, noSilentMembershipMutation: true, noCrossOrgLeakage: true, redactionRequired: true },
        },
        auditEventIds: [71],
        auditTimeline: { eventIds: [71] },
        links: {
            roleRecovery: '/api/admin/support/organizations/org-1/members/member-1/role-recovery',
            audit: '/api/admin/audit-events?org=org-1&target=member-1&entity=member-1&entityType=member',
            user: '/api/admin/support/users/member-1',
        },
        noMutation: true,
        redacted: true,
    })
    expectInspectionAuditQuery('member-1', [
        'event.context->>\'targetUserId\' = $2',
        'event.context->>\'memberId\' = $2',
    ])
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member.inspect', targetType: 'member', targetId: 'member-1',
        organizationId: 'org-1', entityId: 'member-1', outcome: 'success',
        context: { userId: 'member-1', role: 'editor', status: 'active', active: true },
    })
})

test('support invite and member inspection audit missing organizations and targets separately', async () => {
    const missingInviteOrganization = await request(getSupportOrganizationInvite, { params: { id: 'missing-org', inviteId: 'invite-1' } })
    expect(missingInviteOrganization.statusCode).toBe(404)
    expect(missingInviteOrganization.body).toEqual({ error: 'Organization not found.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite.inspect', organizationId: 'missing-org',
        context: { error: 'organization_not_found', inviteId: 'invite-1' },
    })
    expect(state.queries).toHaveLength(1)

    state.queries.length = 0
    state.recordedEvents.length = 0
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionInvite = null
    const missingInvite = await request(getSupportOrganizationInvite, { params: { id: 'org-1', inviteId: 'missing-invite' } })
    expect(missingInvite.statusCode).toBe(404)
    expect(missingInvite.body).toEqual({ error: 'Invite not found for organization.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite.inspect', organizationId: 'org-1',
        context: { error: 'invite_not_found', inviteId: 'missing-invite' },
    })
    expect(state.queries).toHaveLength(2)
    expect(state.queries[1].values).toEqual(['missing-invite', 'org-1'])

    state.queries.length = 0
    state.recordedEvents.length = 0
    state.supportOrganization = null
    const missingMemberOrganization = await request(getSupportOrganizationMember, { params: { id: 'missing-org', userId: 'member-1' } })
    expect(missingMemberOrganization.statusCode).toBe(404)
    expect(missingMemberOrganization.body).toEqual({ error: 'Organization not found.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member.inspect', organizationId: 'missing-org',
        context: { error: 'organization_not_found', userId: 'member-1' },
    })
    expect(state.queries).toHaveLength(1)

    state.queries.length = 0
    state.recordedEvents.length = 0
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionMember = null
    const missingMember = await request(getSupportOrganizationMember, { params: { id: 'org-1', userId: 'missing-member' } })
    expect(missingMember.statusCode).toBe(404)
    expect(missingMember.body).toEqual({ error: 'Organization member not found.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member.inspect', organizationId: 'org-1',
        context: { error: 'member_not_found', userId: 'missing-member' },
    })
    expect(state.queries).toHaveLength(2)
    expect(state.queries[1].values).toEqual(['org-1', 'missing-member'])
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

test('approval-required access recovery holds its invite through the shared revoke contract', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportRecoveryInviteUpsert = {
        id: 'recovery-invite-1', organization_id: 'org-1', email: 'owner@example.test', role: 'admin',
        status: 'pending', expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: null, invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
    }
    state.supportRecoveryInviteResult = {
        id: 'recovery-invite-1', organization_id: 'org-1', email: 'owner@example.test', role: 'admin',
        status: 'revoked', expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: '2026-10-16T00:00:00.000Z', invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
    }

    const result = await request(postSupportAccessRecovery, {
        params: { id: 'org-1' },
        body: {
            email: 'owner@example.test',
            role: 'admin',
            expiresAt: '2026-11-01T00:00:00.000Z',
            reason: 'Restore organization access',
            requestId: 'recovery-request-1',
            approvalRequired: true,
        },
    })

    expect(result.statusCode).toBe(201)
    expect(result.body.recovery).toMatchObject({
        requestId: 'recovery-request-1',
        approvalRequired: true,
        approvalStatus: 'pending_approval',
        invite: { id: 'recovery-invite-1', status: 'revoked' },
    })
    expect(state.inviteActionInputs.at(-1)).toEqual({
        organizationId: 'org-1',
        inviteId: 'recovery-invite-1',
        action: 'revoke',
    })
    expect(state.supportRecoveryApprovalWrites).toBe(1)
})

test('access recovery records a failed audit if an invite is accepted before it can be held', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportRecoveryInviteUpsert = {
        id: 'recovery-invite-1', organization_id: 'org-1', email: 'owner@example.test', role: 'admin',
        status: 'pending', expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: null, invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
    }
    state.supportRecoveryInviteResult = null
    state.supportRecoveryInviteStatus = 'accepted'

    const result = await request(postSupportAccessRecovery, {
        params: { id: 'org-1' },
        body: {
            email: 'owner@example.test',
            role: 'admin',
            expiresAt: '2026-11-01T00:00:00.000Z',
            reason: 'Restore organization access',
            requestId: 'recovery-request-race',
            approvalRequired: true,
        },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.detail).toMatchObject({
        code: 'accepted_invite_not_mutable_by_support_action',
        outcome: 'failed',
        inviteStatus: 'accepted',
        executionReceipt: { outcome: 'failed', inviteStatus: 'accepted' },
    })
    expect(state.supportRecoveryApprovalWrites).toBe(0)
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.access_recovery',
        outcome: 'failed',
        context: { blockerCode: 'accepted_invite_not_mutable_by_support_action', mutation: 'none' },
    })
})

test('access recovery approval uses the shared invite transition and keeps approval pending if the invite is accepted', async () => {
    state.supportDecisionApproval = accessRecoveryApprovalFixture('recovery-approve-race')
    state.supportRecoveryInviteStatus = 'accepted'

    const result = await request(postSupportAccessRecoveryApprove, {
        params: { requestId: 'recovery-approve-race' },
        body: { reason: 'Restore organization access' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.decision.status).toBe('pending_approval')
    expect(result.body.decision.invite.status).toBe('accepted')
    expect(state.inviteActionInputs.at(-1)).toMatchObject({ organizationId: 'org-1', inviteId: 'invite-1', action: 'resend' })
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE admin_access_recovery_approvals'))).toBe(false)
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.access_recovery.approve',
        outcome: 'failed',
        context: { error: 'accepted_invite_not_mutable_by_support_action', mutation: 'none' },
    })
})

test('access recovery approval commits the shared invite transition with its decision', async () => {
    state.supportDecisionApproval = accessRecoveryApprovalFixture('recovery-approve-1')
    state.supportRecoveryInviteStatus = 'revoked'
    state.supportRecoveryInviteResult = { id: 'invite-1', status: 'pending', expires_at: '2026-11-01T00:00:00.000Z' }

    const result = await request(postSupportAccessRecoveryApprove, {
        params: { requestId: 'recovery-approve-1' },
        body: { reason: 'Restore organization access' },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.decision.status).toBe('approved')
    expect(result.body.decision.invite.status).toBe('pending')
    expect(state.inviteActionInputs.at(-1)).toMatchObject({
        organizationId: 'org-1', inviteId: 'invite-1', action: 'resend', expiresAt: '2026-11-01T00:00:00.000Z',
    })
    expect(state.queries.some(({ sql, values }) => sql.includes('UPDATE admin_access_recovery_approvals') && values[1] === 'approved')).toBe(true)
})

test('access recovery denial records its scoped receipt and revokes the shared invite', async () => {
    state.supportDecisionApproval = accessRecoveryApprovalFixture('recovery-deny-1')
    state.supportRecoveryInviteStatus = 'pending'
    state.supportRecoveryInviteResult = { id: 'invite-1', status: 'revoked', expires_at: '2026-11-01T00:00:00.000Z' }

    const result = await request(postSupportAccessRecoveryDeny, {
        params: { requestId: 'recovery-deny-1' },
        body: { reason: 'Request did not meet recovery requirements' },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.decision.status).toBe('denied')
    expect(result.body.decision.invite.status).toBe('revoked')
    expect(result.body.decisionReceipt).toMatchObject({
        action: 'access_recovery_deny',
        actionType: 'support.organization.access_recovery.deny',
        actorId: 'support-admin',
        reason: 'Request did not meet recovery requirements',
        requiredScope: 'recovery:deny',
        scope: ['recovery:deny'],
        outcome: 'denied',
        blockers: ['denied_recovery_approval'],
    })
    expect(state.inviteActionInputs.at(-1)).toMatchObject({ organizationId: 'org-1', inviteId: 'invite-1', action: 'revoke' })
    expect(state.queries.some(({ sql, values }) => sql.includes('UPDATE admin_access_recovery_approvals') && values[1] === 'denied')).toBe(true)
})

test('access recovery approval rejects an expired invite without changing its pending decision', async () => {
    state.supportDecisionApproval = accessRecoveryApprovalFixture('recovery-approve-expired')
    state.supportRecoveryInviteStatus = 'revoked'
    state.supportRecoveryInviteExpiry = new Date(Date.now() - 60_000).toISOString()

    const result = await request(postSupportAccessRecoveryApprove, {
        params: { requestId: 'recovery-approve-expired' },
        body: { reason: 'Restore organization access' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.decisionReceipt.blockers).toContain('access_recovery_invite_expired')
    expect(result.body.decision.status).toBe('pending_approval')
    expect(state.inviteActionWrites).toBe(0)
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE admin_access_recovery_approvals'))).toBe(false)
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.access_recovery.approve',
        outcome: 'failed',
        context: { error: 'access_recovery_invite_expired', mutation: 'none' },
    })
})

test('support invite action success keeps updated invite evidence in executor and receipt', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportRecoveryInviteResult = {
        id: 'invite-1', organization_id: 'org-1', email: 'member@example.com', role: 'reader',
        status: 'pending', expires_at: '2026-12-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: null, invited_by: 'owner-1', created_at: '2026-10-01T00:00:00.000Z',
    }

    const result = await request(postSupportOrganizationInviteAction, {
        params: { id: 'org-1', inviteId: 'invite-1' },
        body: {
            action: 'resend', reason: 'Restore access', scope: 'invite:resend', requestId: 'invite-resend-1',
            expiresAt: '2026-12-01T00:00:00.000Z',
        },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.inviteAction.controlledExecutor).toMatchObject({
        schemaVersion: 'support.action_execute.invite_action.v1',
        action: 'resend', actionType: 'support.organization.invite_resend', requestId: 'invite-resend-1',
        target: { organizationId: 'org-1', inviteId: 'invite-1', email: 'member@example.com' },
        before: { status: 'pending', expiresAt: '2026-11-01T00:00:00.000Z' },
        after: { status: 'pending', expiresAt: '2026-12-01T00:00:00.000Z' }, outcome: 'success',
        supportRoleRequired: true, reasonRequired: true, contextRequired: true, scopeRequired: true,
        expiryRequired: true, noSilentMembershipMutation: true,
    })
    expect(result.body.inviteAction.controlledExecutor.redactedAuditPreview).toEqual({
        schemaVersion: 'support.action_execute.audit_preview.v1',
        actionType: 'support.organization.invite_resend',
        source: 'admin', service: 'hanasand-api',
        requestId: 'invite-resend-1', correlationId: 'invite-resend-1', idempotencyKey: 'invite-resend-1',
        supportSessionId: '[redacted]', organizationId: 'org-1', inviteId: 'invite-1', email: 'member@example.com',
        reason: 'Restore access', scope: ['invite:resend'], outcome: 'success', blockerCode: null, redactionRequired: true,
    })
    expect(result.body.inviteAction.executionReceipt).toMatchObject({
        actorId: 'support-admin', organizationId: 'org-1', requestId: 'invite-resend-1',
        inviteId: 'invite-1', outcome: 'success',
        before: { status: 'pending', expiresAt: '2026-11-01T00:00:00.000Z' },
        after: { status: 'pending', expiresAt: '2026-12-01T00:00:00.000Z' },
    })
})

test('support invite action replay uses the original request id without writing again', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.duplicateInviteAction = { id: 92, request_id: 'original-request' }

    const result = await request(postSupportOrganizationInviteAction, {
        params: { id: 'org-1', inviteId: 'invite-1' },
        body: {
            action: 'resend', reason: 'Restore access', scope: 'invite:resend',
            requestId: 'replay-request', idempotencyKey: 'invite-action-replay-key',
        },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.inviteAction).toMatchObject({ requestId: 'original-request', idempotentReplay: true })
    expect(result.body.inviteAction.controlledExecutor).toMatchObject({
        requestId: 'original-request', outcome: 'success', blockers: ['duplicate_idempotency_key'],
    })
    expect(result.body.inviteAction.executionReceipt).toMatchObject({
        requestId: 'original-request', inviteId: 'invite-1', outcome: 'success',
        blockers: ['duplicate_idempotency_key'],
    })
    expect(state.inviteActionWrites).toBe(0)
    const replayQuery = state.queries.find(({ sql }) => sql.includes('context->>\'idempotencyKey\' = $4'))
    expect(replayQuery?.sql).toContain('subject_id = $3')
    expect(replayQuery?.values).toEqual([
        'support.organization.invite_resend', 'org-1', 'invite-1', 'invite-action-replay-key',
    ])
})

test('invite assistance idempotency replay remains organization-scoped', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.duplicateInviteAction = {
        id: 93, request_id: 'original-assist-request', subject_id: 'invite-1',
        context: { inviteIds: ['invite-1'] },
    }

    const result = await request(postSupportOrganizationInvite, {
        params: { id: 'org-1' },
        body: {
            email: 'member@example.com', reason: 'Restore member access',
            requestId: 'assist-replay-request', idempotencyKey: 'assist-replay-key',
        },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.inviteAssistance).toMatchObject({
        requestId: 'original-assist-request', idempotentReplay: true,
    })
    const replayQuery = state.queries.find(({ sql }) => sql.includes('context->>\'idempotencyKey\' = $4'))
    expect(replayQuery?.sql).toContain('($3::text IS NULL OR subject_id = $3)')
    expect(replayQuery?.values).toEqual(['support.organization.invite_assist', 'org-1', null, 'assist-replay-key'])
})

test('support invite assistance passes the normalized invite to the writer and returns its audited receipt', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportRecoveryInviteUpsert = {
        id: 'assist-invite-1', organization_id: 'org-1', email: 'member@example.com', role: 'reader',
        status: 'pending', expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: null, invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
    }

    const result = await request(postSupportOrganizationInvite, {
        params: { id: 'org-1' },
        body: {
            email: 'Member@Example.com', role: 'reader', expiresAt: '2026-11-01T00:00:00.000Z',
            reason: 'Restore member access', context: 'case-17', scope: 'invite:create',
            requestId: 'invite-assist-success', idempotencyKey: 'invite-assist-success-key',
        },
    })

    expect(result.statusCode).toBe(201)
    expect(organizationInviteUpsertCalls).toHaveLength(1)
    expect(organizationInviteUpsertCalls[0]).toMatchObject({
        organizationId: 'org-1', email: 'member@example.com', role: 'reader',
        invitedBy: 'support-admin', expiresAt: '2026-11-01T00:00:00.000Z',
    })
    expect(state.queries.some(({ sql, values }) => sql.includes('UPDATE organizations SET updated_at = NOW() WHERE id = $1') && values[0] === 'org-1')).toBe(true)
    expect(result.body.invites).toEqual([{
        id: 'assist-invite-1', organizationId: 'org-1', tenantId: 'org-1', acceptanceToken: 'assist-invite-1',
        acceptancePath: '/api/organizations/invites/assist-invite-1/accept', email: 'member@example.com',
        role: 'reader', invitedBy: 'support-admin', acceptedBy: null, status: 'pending',
        createdAt: '2026-10-16T00:00:00.000Z', expiresAt: '2026-11-01T00:00:00.000Z', acceptedAt: null,
    }])
    expect(result.body.inviteAssistance).toMatchObject({
        schemaVersion: 'support.invite_assist.v1', requestId: 'invite-assist-success',
        actorId: 'support-admin', outcome: 'success', idempotencyKey: 'invite-assist-success-key',
        correlationId: 'invite-assist-success', auditEventIds: [91], noSilentMembershipMutation: true,
        executionReceipt: {
            schemaVersion: 'support.invite_assist.execution_receipt.v1',
            mutationMode: 'controlled_invite_row_only', action: 'invite_assist',
            actionType: 'support.organization.invite_assist', outcome: 'success',
            inviteIds: ['assist-invite-1'], emails: ['member@example.com'], role: 'reader',
            requestId: 'invite-assist-success', idempotencyKey: 'invite-assist-success-key',
            auditEventIds: [91], blockers: [],
        },
    })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite_assist', actorId: 'support-admin',
        targetType: 'organization', targetId: 'org-1', entityId: 'assist-invite-1',
        requestId: 'invite-assist-success', severity: 'notice', outcome: 'success',
        context: {
            schemaVersion: 'support.invite_assist.v1', inviteIds: ['assist-invite-1'],
            emails: ['member@example.com'], role: 'reader', idempotencyKey: 'invite-assist-success-key',
            noSilentMembershipMutation: true, mutation: 'invite_row_only', supportContext: 'case-17',
        },
    })
})

test('support invite action returns an audited accepted-invite denial when acceptance wins the update race', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.acceptedInviteWinsRace = true

    const result = await request(postSupportOrganizationInviteAction, {
        params: { id: 'org-1', inviteId: 'invite-1' },
        body: { action: 'resend', reason: 'Restore access', scope: 'invite:resend', requestId: 'request-1' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.inviteAction).toMatchObject({
        schemaVersion: 'support.invite_action.v1',
        outcome: 'failed',
        noSilentMembershipMutation: true,
        before: { status: 'accepted' },
        after: { status: 'accepted' },
        auditEventIds: [91],
    })
    expect(state.recordedEvents.at(-1)?.context).toMatchObject({
        email: 'member@example.com',
        role: 'reader',
        handoffExpiresAt: null,
        error: 'accepted_invite_not_mutable_by_support_action',
        supportContext: '',
    })
    expect(state.recordedEvents.at(-1)?.context).toHaveProperty('executor')
    expect(state.inviteActionWrites).toBe(1)
})

test('support invite action denies an already accepted invite without attempting an update', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionInvite = { ...supportInviteInspectionFixture(), status: 'accepted' }

    const result = await request(postSupportOrganizationInviteAction, { params: { id: 'org-1', inviteId: 'invite-1' }, body: { action: 'resend', reason: 'Restore access', scope: 'invite:resend' } })

    expect(result.statusCode).toBe(409)
    expect(state.inviteActionWrites).toBe(0)
})

test('executor blocker audits retain the shared no-mutation contract for invite assistance', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportAvailabilityResults = [[{ organization_id: 'org-1', active_admin_count: 1 }]]

    const result = await request(postSupportOrganizationInvite, {
        params: { id: 'org-1' },
        body: {
            email: 'member@example.com', role: 'reader', expiresAt: '2026-11-01T00:00:00.000Z',
            reason: 'Restore member access', requestId: 'invite-assist-blocked', context: 'case-17',
        },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.detail.executorBlocker).toMatchObject({
        schemaVersion: 'support.action_execute.invite_assist.v1',
        supportRoleRequired: true, reasonRequired: true, contextRequired: true, scopeRequired: true,
        expiryRequired: true, noSilentMembershipMutation: true, requestId: 'invite-assist-blocked',
    })
    expect(result.body.detail.executorBlocker.redactedAuditPreview).toEqual({
        schemaVersion: 'support.action_execute.audit_preview.v1',
        actionType: 'support.organization.invite_assist',
        source: 'admin', service: 'hanasand-api',
        requestId: 'invite-assist-blocked', correlationId: 'invite-assist-blocked', idempotencyKey: 'invite-assist-blocked',
        supportSessionId: '[redacted]', organizationId: 'org-1', emails: ['member@example.com'], inviteIds: [],
        reason: 'Restore member access', scope: ['invite:create'], expiresAt: '2026-11-01T00:00:00.000Z',
        outcome: 'denied', blockerCode: 'active_admin_available', redactionRequired: true,
    })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite_assist',
        targetType: 'organization', targetId: 'org-1', entityId: 'member@example.com',
        severity: 'notice', outcome: 'denied',
        context: {
            schemaVersion: 'support.action_executor_blocker.v1', action: 'invite_assist',
            blocker: 'active_admin_available', blockerCode: 'active_admin_available',
            targetOrganizationId: 'org-1', emails: ['member@example.com'], role: 'reader',
            noSilentMembershipMutation: true, mutation: 'none', redactionRequired: true,
            supportContext: 'case-17',
        },
    })
})

test('support writes reject organizations with an active privacy deletion marker', async () => {
    state.supportOrganization = {
        ...activeSupportOrganizationFixture(),
        audit_safe_metadata: { privacyDeletionRunId: 'deletion-run-1' },
    }

    const result = await request(postSupportOrganizationInvite, {
        params: { id: 'org-1' },
        body: {
            email: 'member@example.com', role: 'reader', expiresAt: '2026-11-01T00:00:00.000Z',
            reason: 'Restore member access', requestId: 'invite-assist-deletion-blocked',
        },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body).toEqual({ error: 'Organization deletion is in progress; support writes are blocked.' })
    expect(state.recordedEvents).toHaveLength(0)
})

test('executor blocker audits retain invite action identity and severity', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()

    const result = await request(postSupportOrganizationInviteAction, {
        params: { id: 'org-1', inviteId: 'invite-1' },
        body: { action: 'revoke', reason: 'Remove unsafe access', scope: 'invalid', requestId: 'invite-action-blocked' },
    })

    expect(result.statusCode).toBe(400)
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite_revoke',
        targetType: 'invite', targetId: 'invite-1', entityId: 'invite-1',
        severity: 'warning', outcome: 'denied',
        context: {
            schemaVersion: 'support.action_executor_blocker.v1', action: 'revoke',
            blocker: 'invalid_scope', blockerCode: 'invalid_scope', inviteId: 'invite-1',
            noSilentMembershipMutation: true, mutation: 'none', redactionRequired: true,
        },
    })
})

test('executor blocker audits retain resend and admin-role severity rules', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()

    const resend = await request(postSupportOrganizationInviteAction, {
        params: { id: 'org-1', inviteId: 'invite-1' },
        body: { action: 'resend', reason: 'Restore access', scope: 'invalid', requestId: 'resend-blocked' },
    })
    expect(resend.statusCode).toBe(400)
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite_resend', severity: 'notice', outcome: 'denied',
        context: { action: 'resend', blockerCode: 'invalid_scope', mutation: 'none' },
    })

    const roleRecovery = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: { role: 'admin', reason: 'Restore admin access', scope: 'invalid', requestId: 'admin-role-blocked' },
    })
    expect(roleRecovery.statusCode).toBe(400)
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member_role_recovery', severity: 'warning', outcome: 'denied',
        context: { action: 'member_role_recovery', requestedRole: 'admin', blockerCode: 'invalid_scope', mutation: 'none' },
    })
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE organization_members SET role'))).toBe(false)
})

test('support role recovery shares the active-member write and retains its audited receipt', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()

    const result = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: { role: 'reader', reason: 'Restore member access', scope: 'member:role_recovery', requestId: 'role-request-1' },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.memberRoleRecovery).toMatchObject({
        schemaVersion: 'support.member_role_recovery.v1',
        outcome: 'success',
        before: { role: 'editor' },
        after: { role: 'reader' },
        noSilentMembershipMutation: true,
    })
    expect(result.body.memberRoleRecovery.controlledExecutor).toMatchObject({
        schemaVersion: 'support.action_execute.member_role_recovery.v1',
        mutationMode: 'controlled_member_role_only',
        outcome: 'success',
        supportRoleRequired: true, reasonRequired: true, contextRequired: true, scopeRequired: true,
        noSilentMembershipMutation: true,
    })
    expect(result.body.memberRoleRecovery.controlledExecutor.redactedAuditPreview).toEqual({
        schemaVersion: 'support.action_execute.audit_preview.v1',
        actionType: 'support.organization.member_role_recovery',
        source: 'admin', service: 'hanasand-api',
        requestId: 'role-request-1', correlationId: 'role-request-1', idempotencyKey: 'role-request-1',
        supportSessionId: '[redacted]', organizationId: 'org-1', targetUserId: 'member-1', requestedRole: 'reader',
        reason: 'Restore member access', scope: ['member:role_recovery'], outcome: 'success', blockerCode: null, redactionRequired: true,
    })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member_role_recovery',
        outcome: 'success',
    })
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE organization_members') && sql.includes('status = \'active\''))).toBe(true)
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE organizations SET updated_at = NOW()'))).toBe(true)
})

test('support role recovery treats an already-set role as an audited no-op', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportMemberRole = 'editor'
    state.supportOwnerCounts = [2]

    const result = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: { role: 'editor', reason: 'Restore member access', scope: 'member:role_recovery', requestId: 'role-noop-1' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.error).toBe('Member already has the requested role.')
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE organization_members') && sql.includes('SET role = $3'))).toBe(false)
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member_role_recovery',
        outcome: 'failed',
        context: { error: 'member_role_already_set', noSilentMembershipMutation: true, mutation: 'none' },
    })
})

test('member role recovery idempotency replay remains member-scoped', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.duplicateInviteAction = { id: 94, request_id: 'original-role-request' }

    const result = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: {
            role: 'reader', reason: 'Restore member access', scope: 'member:role_recovery',
            requestId: 'role-replay-request', idempotencyKey: 'member-replay-key',
        },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.memberRoleRecovery).toMatchObject({
        requestId: 'original-role-request', idempotentReplay: true,
    })
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE organization_members'))).toBe(false)
    const replayQuery = state.queries.find(({ sql }) => sql.includes('context->>\'idempotencyKey\' = $4'))
    expect(replayQuery?.sql).toContain('subject_id = $3')
    expect(replayQuery?.values).toEqual(['support.organization.member_role_recovery', 'org-1', 'member-1', 'member-replay-key'])
})

test('support role recovery rechecks owner protection inside the membership transaction', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportMemberRole = 'owner'
    state.supportOwnerCounts = [2, 1]

    const result = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: { role: 'reader', reason: 'Restore member access', scope: 'member:role_recovery', requestId: 'role-race-1' },
    })

    expect(result.statusCode).toBe(403)
    expect(result.body.detail.code).toBe('Support role recovery cannot demote the last active owner.')
    expect(result.body.detail.executorBlocker.blockers).toContain('Support role recovery cannot demote the last active owner.')
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE organization_members') && sql.includes('SET role = $3'))).toBe(false)
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member_role_recovery',
        outcome: 'denied',
        context: {
            schemaVersion: 'support.action_executor_blocker.v1', action: 'member_role_recovery',
            blocker: 'Support role recovery cannot demote the last active owner.',
            blockerCode: 'Support role recovery cannot demote the last active owner.',
            targetOrganizationId: 'org-1', targetUserId: 'member-1', requestedRole: 'reader',
            noSilentMembershipMutation: true, mutation: 'none', redactionRequired: true,
        },
    })
    expect(state.queries.some(({ sql }) => sql.includes('FROM users') && sql.includes('organization_members membership') && sql.includes('FOR UPDATE'))).toBe(true)
})

test('support role recovery locks active organization admins and rechecks their availability', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportAvailabilityResults = [[], [{ organization_id: 'org-1', active_admin_count: 1 }]]

    const result = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: { role: 'reader', reason: 'Restore member access', scope: 'member:role_recovery', requestId: 'role-admin-race-1' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.detail.code).toBe('active_admin_available')
    expect(state.queries.some(({ sql }) => sql.includes('membership.role IN (\'owner\', \'admin\')') && sql.includes('FOR UPDATE'))).toBe(true)
    expect(state.queries.some(({ sql }) => sql.includes('UPDATE organization_members') && sql.includes('SET role = $3'))).toBe(false)
})

test('access recovery search applies requester, approver, status, outcome, organization, and request filters', async () => {
    state.approvalRows = [{
        request_id: 'recovery-1',
        organization_id: 'org-1',
        organization_name: 'Org One',
        invite_id: 'invite-1',
        target_user_id: 'user-1',
        requested_by: 'admin-one',
        requested_reason: 'Customer lost access to their organization account',
        request_context: { caseId: 'case-7' },
        approval_required: true,
        status: 'pending',
        approved_by: null,
        approved_at: null,
        denied_by: null,
        denied_at: null,
        decision_reason: null,
        outcome: 'success',
        expires_at: '2026-10-01T00:00:00.000Z',
        created_at: '2026-09-20T00:00:00.000Z',
        updated_at: '2026-09-20T00:00:00.000Z',
        email: 'owner@example.test',
        role: 'system',
        invite_status: 'revoked',
        audit_events: [{ id: 98, actionType: 'support.organization.access_recovery', outcome: 'success' }],
    }]

    const response = await request(getSupportAccessRecoveryApprovals, {
        query: {
            requestId: 'recovery-1',
            org: 'org-1',
            status: 'pending',
            outcome: 'success',
            requester: 'admin-one',
            approver: 'admin-two',
            limit: '20',
        },
    })
    expect(response.statusCode).toBe(200)
    expect(response.body.approvals[0]).toMatchObject({
        schemaVersion: 'support.access_recovery.approval_decision.v1',
        requestId: 'recovery-1',
        organizationId: 'org-1',
        status: 'pending_approval',
        requestedBy: 'admin-one',
        auditEventIds: [98],
        invite: { id: 'invite-1', email: 'owner@example.test', status: 'revoked' },
    })
    expect(state.queries).toHaveLength(1)
    expect(state.queries[0].sql).toContain('approval.request_id ILIKE')
    expect(state.queries[0].sql).toContain('approval.organization_id ILIKE')
    expect(state.queries[0].sql).toContain('approval.status =')
    expect(state.queries[0].sql).toContain('approval.outcome =')
    expect(state.queries[0].sql).toContain('approval.requested_by ILIKE')
    expect(state.queries[0].sql).toContain('approval.approved_by ILIKE')
    expect(state.queries[0].sql).toContain('approval.denied_by ILIKE')
    expect(state.queries[0].values).toEqual(['%recovery-1%', '%org-1%', 'pending', 'success', '%admin-one%', '%admin-two%', 20])
})
