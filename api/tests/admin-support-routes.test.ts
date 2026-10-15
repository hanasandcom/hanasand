import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'

let actor = { valid: true, id: 'support-admin', impersonating: false }
let internalAccess = true
let eventRows: Record<string, any>[] = []
let approvalRows: Record<string, any>[] = []
let supportDecisionApproval: Record<string, any> | null = null
let supportOrganization: Record<string, any> | null = null
let supportInviteReads = 0
let inviteActionWrites = 0
let acceptedInviteWinsRace = false
let supportRecoveryInviteStatus: string | null = null
let supportRecoveryInviteExpiry: string | null = '2026-11-01T00:00:00.000Z'
let supportRecoveryInviteUpsert: Record<string, unknown> | null = null
let supportRecoveryInviteResult: Record<string, unknown> | null = null
let supportRecoveryApprovalWrites = 0
let supportMemberRole = 'editor'
let supportOwnerCounts = [2]
let supportAvailabilityResults: Record<string, unknown>[][] = []
const inviteActionInputs: Array<Record<string, unknown>> = []
let supportSessionEvents: Record<string, unknown>[] = []
const queries: Array<{ sql: string, values: unknown[] }> = []

async function run(sql: string, values: unknown[] = []) {
    queries.push({ sql, values })
    if (sql.includes('event_type IN (\'support.session.create\', \'support.session.revoke\')')) {
        const sessionId = values[0]
        return { rows: supportSessionEvents.filter(event => event.subject_id === sessionId && ['support.session.create', 'support.session.revoke'].includes(String(event.event_type))) }
    }
    if (sql.includes('FROM system_events e') && sql.includes('e.context->>\'supportSessionId\' = $1')) {
        const sessionId = values[0]
        return { rows: supportSessionEvents.filter(event => event.subject_id === sessionId || (event.context as Record<string, unknown>)?.supportSessionId === sessionId) }
    }
    if (sql.includes('SELECT status') && sql.includes('FROM organization_invites') && sql.includes('organization_id = $2')) {
        return { rows: supportRecoveryInviteStatus ? [{ status: supportRecoveryInviteStatus }] : [] }
    }
    if (sql.includes('SELECT id, status, expires_at') && sql.includes('FROM organization_invites')) {
        return { rows: supportRecoveryInviteStatus ? [{ id: 'invite-1', status: supportRecoveryInviteStatus, expires_at: supportRecoveryInviteExpiry }] : [] }
    }
    if (sql.includes('FROM organizations o') && supportOrganization) return { rows: [supportOrganization] }
    if (sql.includes('FROM organization_invites') && sql.includes('id = $1') && sql.includes('organization_id = $2')) {
        supportInviteReads += 1
        const invite = {
            id: 'invite-1', organization_id: 'org-1', email: 'member@example.com', role: 'reader',
            status: supportInviteReads > 1 && acceptedInviteWinsRace ? 'accepted' : 'pending',
            expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
            revoked_at: null, invited_by: 'owner-1', created_at: '2026-10-01T00:00:00.000Z',
        }
        return { rows: [invite] }
    }
    if (sql.includes('FROM organization_members om') && sql.includes('WHERE om.organization_id = $1') && sql.includes('om.user_id = $2')) {
        return { rows: [{
            organization_id: 'org-1', organization_name: 'Org', organization_slug: 'org', user_id: 'member-1',
            name: 'Member', avatar: null, active: true, role: supportMemberRole, status: 'active', invited_by: 'owner-1',
            joined_at: '2026-10-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        }] }
    }
    if (sql.includes('SELECT COUNT(*)::int AS owner_count') && sql.includes('FROM organization_members membership')) return { rows: [{ owner_count: supportOwnerCounts.shift() ?? 2 }] }
    if (sql.includes('active_admin_count')) return { rows: supportAvailabilityResults.shift() ?? [] }
    if (sql.includes('context->>\'idempotencyKey\'') && sql.includes('outcome = \'success\'')) return { rows: [] }
    if (sql.includes('WHERE request_id = $1') && sql.includes('event_type = $2') && sql.includes('subject_id = $3')) {
        if (String(values[1]).startsWith('support.session.')) {
            return { rows: supportSessionEvents.filter(event => event.request_id === values[0] && event.event_type === values[1] && event.subject_id === values[2]).map(event => ({ id: event.id })) }
        }
        return { rows: [{ id: 91 }] }
    }
    if (sql.includes('UPDATE organization_members') && sql.includes('SET role = $3')) return { rows: [{
        organization_id: 'org-1', user_id: 'member-1', role: 'reader', status: 'active',
    }] }
    if (sql.includes('UPDATE admin_access_recovery_approvals')) {
        return { rows: supportDecisionApproval ? [{ ...supportDecisionApproval, status: sql.includes('SET status = \'approved\'') ? 'approved' : 'denied' }] : [] }
    }
    if (sql.includes('FROM admin_access_recovery_approvals approval')) return { rows: sql.includes('WHERE approval.request_id = $1') && supportDecisionApproval ? [supportDecisionApproval] : approvalRows }
    if (sql.includes('SELECT COUNT(*)::int AS total')) return { rows: [{ total: eventRows.length }] }
    if (sql.includes('FROM system_events e') && sql.includes('WHERE e.id = $1')) return { rows: eventRows }
    if (sql.includes('FROM system_events e')) return { rows: eventRows }
    return { rows: [] }
}

const recordedEvents: Array<Record<string, unknown>> = []
let nextSupportEventId = 100
const systemEventUtils = await import('../src/utils/systemEvent.ts')
mock.module('../src/utils/db.ts', () => ({ default: run, queryOnce: run, identityQueryOnce: run, withTransaction: async (work: (query: typeof run) => Promise<unknown>) => work(run), closeDatabase: async () => {} }))
const identityDataWrites = await import('../src/utils/db/identityDataWrites.ts')
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => actor }))
mock.module('../src/utils/systemEvent.ts', () => ({
    ...systemEventUtils,
    actorHasHanasandInternalAccess: async () => internalAccess,
    recordSystemEvent: async (_req: unknown, event: Record<string, unknown>) => {
        recordedEvents.push(event)
        if (['support.session.create', 'support.session.revoke', 'support.session.inspect'].includes(String(event.actionType))) {
            supportSessionEvents.push({
                id: nextSupportEventId++,
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
    upsertAdminAccessRecoveryApproval: async () => { supportRecoveryApprovalWrites += 1 },
    upsertOrganizationInvite: async () => supportRecoveryInviteUpsert,
    updateOrganizationInviteAction: async (input: Record<string, unknown>) => {
        inviteActionWrites += 1
        inviteActionInputs.push(input)
        return supportRecoveryInviteResult
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
    postSupportOrganizationInvite,
    postSupportOrganizationInviteAction,
    postSupportOrganizationMemberRoleRecovery,
    postSupportSession,
    getSupportSession,
    postSupportSessionRevoke,
    postSupportAccessRecovery,
    postSupportAccessRecoveryApprove,
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

beforeEach(() => {
    actor = { valid: true, id: 'support-admin', impersonating: false }
    internalAccess = true
    eventRows = []
    approvalRows = []
    supportDecisionApproval = null
    supportOrganization = null
    supportInviteReads = 0
    inviteActionWrites = 0
    acceptedInviteWinsRace = false
    supportRecoveryInviteStatus = null
    supportRecoveryInviteExpiry = '2026-11-01T00:00:00.000Z'
    supportRecoveryInviteUpsert = null
    supportRecoveryInviteResult = null
    supportRecoveryApprovalWrites = 0
    supportMemberRole = 'editor'
    supportOwnerCounts = [2]
    supportAvailabilityResults = []
    inviteActionInputs.length = 0
    supportSessionEvents = []
    nextSupportEventId = 100
    queries.length = 0
    recordedEvents.length = 0
})

test('support audit routes enforce admin-only access and reject impersonated actors', async () => {
    actor = { valid: false, id: '', impersonating: false }
    expect((await request(getSystemEvents)).statusCode).toBe(401)
    expect(queries).toHaveLength(0)

    actor = { valid: true, id: 'support-admin', impersonating: true }
    expect((await request(getSystemEvents)).statusCode).toBe(401)
    expect(queries).toHaveLength(0)

    actor = { valid: true, id: 'customer-user', impersonating: false }
    internalAccess = false
    const denied = await request(getSystemEvents)
    expect(denied.statusCode).toBe(403)
    expect(denied.body.detail.code).toBe('support_role_required')
    expect((await request(getSupportAccessRecoveryApprovals)).statusCode).toBe(403)
    expect(queries).toHaveLength(0)
})

test('audit event filters are parameterized and context secrets are redacted in responses', async () => {
    eventRows = [{
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
        severity: 'warning',
        outcome: 'success',
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T00:00:00.000Z',
    }
    const response = await request(getSystemEvents, { query: filters })
    expect(response.statusCode).toBe(200)
    expect(queries).toHaveLength(2)
    const query = queries[1]
    expect(query.sql).toContain('e.event_type ILIKE')
    expect(query.sql).toContain('e.context->>\'correlationId\' ILIKE')
    expect(query.sql).toContain('e.context->>\'idempotencyKey\' ILIKE')
    expect(query.sql).toContain('e.context->>\'supportSessionId\' ILIKE')
    expect(query.sql).toContain('e.context->>\'workflow\' ILIKE')
    expect(query.sql).toContain('e.context->>\'blockerCode\' ILIKE')
    expect(query.sql).toContain('e.context->>\'supportScope\' ILIKE')
    expect(query.sql).not.toContain('needle\' OR 1=1 --')
    expect(query.values).toContain('%needle\' OR 1=1 --%')
    expect(query.values).toContain('%org-1%')
    expect(query.values).toContain('%support.organization.inspect%')
    expect(query.values).toContain('%request-1%')
    expect(query.values).toContain('%corr-1%')
    expect(query.values).toContain('%idem-1%')
    expect(query.values).toContain('%session-1%')
    expect(query.values).toContain('%case-7%')
    expect(query.values).not.toContain('support.organization.inspect OR 1=1')

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
    eventRows = [{
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
    }]
    const response = await request(getSystemEvent, { params: { id: '42' } })
    expect(response.statusCode).toBe(200)
    expect(response.body.event.context).toEqual({
        password: '[redacted]',
        nested: { privateSourceUrl: '[redacted]' },
        safe: 'kept',
    })
    expect(response.body.detail.timelineEvent.context).toEqual(response.body.event.context)
    expect(recordedEvents).toHaveLength(1)
    expect(recordedEvents[0]).toMatchObject({
        actionType: 'support.audit_event.inspect',
        actorId: 'support-admin',
        outcome: 'success',
        context: { redactionRequired: true, inspectedEventId: 42 },
    })
})

test('audit detail links only explicit or tagged support sessions', async () => {
    eventRows = [{
        id: 43, event_type: 'impersonation.start', severity: 'warning', source: 'admin', service: 'hanasand-api',
        actor_id: 'support-admin', object_type: 'user', object_id: 'target-user', organization_id: 'org-1',
        subject_id: 'support_session_tagged', request_id: 'request-tagged', outcome: 'success', reason: 'Support case',
        context: { sessionId: 'impersonation-session' }, created_at: '2026-10-16T00:00:00.000Z',
    }]
    const tagged = await request(getSystemEvent, { params: { id: '43' } })
    expect(tagged.body.event.detail.timelineEvent.links.supportSession).toBe('/api/admin/support/sessions/support_session_tagged')
    expect(tagged.body.detail.filterContract.filters.supportSession).toBe('support_session_tagged')

    eventRows = [{
        ...eventRows[0], subject_id: 'target-user', context: { supportSessionId: 'real-support-session' },
    }]
    const explicit = await request(getSystemEvent, { params: { id: '43' } })
    expect(explicit.body.event.context.supportSessionId).toBe('[redacted]')
    expect(explicit.body.event.detail.timelineEvent.links.supportSession).toBe('/api/admin/support/sessions/real-support-session')
    expect(explicit.body.event.detail.actionEvidence.supportSessionId).toBe('real-support-session')
    expect(explicit.body.detail.filterContract.filters.supportSession).toBe('real-support-session')

    eventRows = [{
        ...eventRows[0], subject_id: 'impersonation-session', context: { sessionId: 'impersonation-session' },
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
    expect(queries).toHaveLength(0)
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
    expect(queries).toHaveLength(0)
})

test('support readiness preserves its default audit filters and limit cap', async () => {
    const response = await request(getSupportReadiness, { query: { org: 'org-1', limit: '80' } })
    expect(response.statusCode).toBe(200)
    expect(response.body.filteredTimeline.filter).toMatchObject({
        action: 'support', source: 'system', service: 'hanasand-api', limit: 50,
    })
    const auditQuery = queries.find(query => query.sql.includes('FROM system_events event'))
    expect(auditQuery?.values).toEqual(['%org-1%', '%support%', '%system%', '%hanasand-api%', 50])
})

test('support inspection keeps organization member and pending-invite counts in its response', async () => {
    supportOrganization = {
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

    const detail = await request(getSupportOrganization, { params: { id: 'org-1' } })
    expect(detail.statusCode).toBe(200)
    expect(detail.body.organization).toMatchObject({
        id: 'org-1',
        memberCount: 3,
        pendingInviteCount: 2,
    })
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
    expect(recordedEvents.at(-1)).toMatchObject({ actionType: 'support.session.revoke', outcome: 'failed', context: { blockerCode: 'support_session_revoked' } })

    const inspectedAfterRevoke = await request(getSupportSession, { params: { sessionId } })
    expect(inspectedAfterRevoke.statusCode).toBe(200)
    expect(inspectedAfterRevoke.body.supportSession).toMatchObject({ id: sessionId, status: 'revoked' })
    expect(recordedEvents.filter(event => ['support.session.create', 'support.session.revoke'].includes(String(event.actionType)))).toHaveLength(3)
})

test('expired support session revoke uses the lifecycle status and records a denial', async () => {
    const sessionId = 'support_session_expired'
    supportSessionEvents.push({
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
    expect(recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.session.revoke',
        outcome: 'denied',
        context: { supportSessionId: sessionId, blockerCode: 'support_session_expired' },
    })
    expect(supportSessionEvents.filter(event => event.subject_id === sessionId && event.event_type === 'support.session.revoke' && event.outcome === 'success')).toHaveLength(0)
})

test('approval-required access recovery holds its invite through the shared revoke contract', async () => {
    supportOrganization = activeSupportOrganizationFixture()
    supportRecoveryInviteUpsert = {
        id: 'recovery-invite-1', organization_id: 'org-1', email: 'owner@example.test', role: 'admin',
        status: 'pending', expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: null, invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
    }
    supportRecoveryInviteResult = {
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
    expect(inviteActionInputs.at(-1)).toEqual({
        organizationId: 'org-1',
        inviteId: 'recovery-invite-1',
        action: 'revoke',
    })
    expect(supportRecoveryApprovalWrites).toBe(1)
})

test('access recovery records a failed audit if an invite is accepted before it can be held', async () => {
    supportOrganization = activeSupportOrganizationFixture()
    supportRecoveryInviteUpsert = {
        id: 'recovery-invite-1', organization_id: 'org-1', email: 'owner@example.test', role: 'admin',
        status: 'pending', expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: null, invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
    }
    supportRecoveryInviteResult = {
        id: 'recovery-invite-1', organization_id: 'org-1', email: 'owner@example.test', role: 'admin',
        status: 'revoked', expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: '2026-10-16T00:00:00.000Z', invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
    }
    supportRecoveryInviteResult = null
    supportRecoveryInviteStatus = 'accepted'

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
    expect(supportRecoveryApprovalWrites).toBe(0)
    expect(recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.access_recovery',
        outcome: 'failed',
        context: { blockerCode: 'accepted_invite_not_mutable_by_support_action', mutation: 'none' },
    })
})

test('access recovery approval uses the shared invite transition and keeps approval pending if the invite is accepted', async () => {
    supportDecisionApproval = {
        request_id: 'recovery-approve-race', organization_id: 'org-1', invite_id: 'invite-1', target_user_id: 'user-1',
        requested_by: 'requester', requested_reason: 'Restore account access', request_context: '', approval_required: true,
        status: 'pending', approved_by: null, approved_at: null, denied_by: null, denied_at: null, decision_reason: null,
        outcome: 'success', expires_at: '2026-11-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z', email: 'member@example.com', role: 'reader', invite_status: 'revoked', organization_name: 'Org',
    }
    supportRecoveryInviteStatus = 'accepted'

    const result = await request(postSupportAccessRecoveryApprove, {
        params: { requestId: 'recovery-approve-race' },
        body: { reason: 'Restore organization access' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.decision.status).toBe('pending_approval')
    expect(result.body.decision.invite.status).toBe('accepted')
    expect(inviteActionInputs.at(-1)).toMatchObject({ organizationId: 'org-1', inviteId: 'invite-1', action: 'resend' })
    expect(queries.some(({ sql }) => sql.includes('UPDATE admin_access_recovery_approvals'))).toBe(false)
    expect(recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.access_recovery.approve',
        outcome: 'failed',
        context: { error: 'accepted_invite_not_mutable_by_support_action', mutation: 'none' },
    })
})

test('access recovery approval commits the shared invite transition with its decision', async () => {
    supportDecisionApproval = {
        request_id: 'recovery-approve-1', organization_id: 'org-1', invite_id: 'invite-1', target_user_id: 'user-1',
        requested_by: 'requester', requested_reason: 'Restore account access', request_context: '', approval_required: true,
        status: 'pending', approved_by: null, approved_at: null, denied_by: null, denied_at: null, decision_reason: null,
        outcome: 'success', expires_at: '2026-11-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z', email: 'member@example.com', role: 'reader', invite_status: 'revoked', organization_name: 'Org',
    }
    supportRecoveryInviteStatus = 'revoked'
    supportRecoveryInviteResult = { id: 'invite-1', status: 'pending', expires_at: '2026-11-01T00:00:00.000Z' }

    const result = await request(postSupportAccessRecoveryApprove, {
        params: { requestId: 'recovery-approve-1' },
        body: { reason: 'Restore organization access' },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.decision.status).toBe('approved')
    expect(result.body.decision.invite.status).toBe('pending')
    expect(inviteActionInputs.at(-1)).toMatchObject({
        organizationId: 'org-1', inviteId: 'invite-1', action: 'resend', expiresAt: '2026-11-01T00:00:00.000Z',
    })
    expect(queries.some(({ sql }) => sql.includes('UPDATE admin_access_recovery_approvals') && sql.includes('status = \'approved\''))).toBe(true)
})

test('access recovery approval rejects an expired invite without changing its pending decision', async () => {
    supportDecisionApproval = {
        request_id: 'recovery-approve-expired', organization_id: 'org-1', invite_id: 'invite-1', target_user_id: 'user-1',
        requested_by: 'requester', requested_reason: 'Restore account access', request_context: '', approval_required: true,
        status: 'pending', approved_by: null, approved_at: null, denied_by: null, denied_at: null, decision_reason: null,
        outcome: 'success', expires_at: '2026-11-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z', email: 'member@example.com', role: 'reader', invite_status: 'revoked', organization_name: 'Org',
    }
    supportRecoveryInviteStatus = 'revoked'
    supportRecoveryInviteExpiry = new Date(Date.now() - 60_000).toISOString()

    const result = await request(postSupportAccessRecoveryApprove, {
        params: { requestId: 'recovery-approve-expired' },
        body: { reason: 'Restore organization access' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.decisionReceipt.blockers).toContain('access_recovery_invite_expired')
    expect(result.body.decision.status).toBe('pending_approval')
    expect(inviteActionWrites).toBe(0)
    expect(queries.some(({ sql }) => sql.includes('UPDATE admin_access_recovery_approvals'))).toBe(false)
    expect(recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.access_recovery.approve',
        outcome: 'failed',
        context: { error: 'access_recovery_invite_expired', mutation: 'none' },
    })
})

test('support invite action returns an audited accepted-invite denial when acceptance wins the update race', async () => {
    supportOrganization = activeSupportOrganizationFixture()
    acceptedInviteWinsRace = true

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
    expect(recordedEvents.at(-1)?.context).toMatchObject({
        email: 'member@example.com',
        role: 'reader',
        handoffExpiresAt: null,
        error: 'accepted_invite_not_mutable_by_support_action',
        supportContext: '',
    })
    expect(recordedEvents.at(-1)?.context).toHaveProperty('executor')
    expect(inviteActionWrites).toBe(1)
})

test('executor blocker audits retain the shared no-mutation contract for invite assistance', async () => {
    supportOrganization = activeSupportOrganizationFixture()
    supportAvailabilityResults = [[{ organization_id: 'org-1', active_admin_count: 1 }]]

    const result = await request(postSupportOrganizationInvite, {
        params: { id: 'org-1' },
        body: {
            email: 'member@example.com', role: 'reader', expiresAt: '2026-11-01T00:00:00.000Z',
            reason: 'Restore member access', requestId: 'invite-assist-blocked', context: 'case-17',
        },
    })

    expect(result.statusCode).toBe(409)
    expect(recordedEvents.at(-1)).toMatchObject({
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

test('executor blocker audits retain invite action identity and severity', async () => {
    supportOrganization = activeSupportOrganizationFixture()

    const result = await request(postSupportOrganizationInviteAction, {
        params: { id: 'org-1', inviteId: 'invite-1' },
        body: { action: 'revoke', reason: 'Remove unsafe access', scope: 'invalid', requestId: 'invite-action-blocked' },
    })

    expect(result.statusCode).toBe(400)
    expect(recordedEvents.at(-1)).toMatchObject({
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
    supportOrganization = activeSupportOrganizationFixture()

    const resend = await request(postSupportOrganizationInviteAction, {
        params: { id: 'org-1', inviteId: 'invite-1' },
        body: { action: 'resend', reason: 'Restore access', scope: 'invalid', requestId: 'resend-blocked' },
    })
    expect(resend.statusCode).toBe(400)
    expect(recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite_resend', severity: 'notice', outcome: 'denied',
        context: { action: 'resend', blockerCode: 'invalid_scope', mutation: 'none' },
    })

    const roleRecovery = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: { role: 'admin', reason: 'Restore admin access', scope: 'invalid', requestId: 'admin-role-blocked' },
    })
    expect(roleRecovery.statusCode).toBe(400)
    expect(recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member_role_recovery', severity: 'warning', outcome: 'denied',
        context: { action: 'member_role_recovery', requestedRole: 'admin', blockerCode: 'invalid_scope', mutation: 'none' },
    })
    expect(queries.some(({ sql }) => sql.includes('UPDATE organization_members SET role'))).toBe(false)
})

test('support role recovery shares the active-member write and retains its audited receipt', async () => {
    supportOrganization = activeSupportOrganizationFixture()

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
        mutationMode: 'controlled_member_role_only',
        outcome: 'success',
    })
    expect(recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member_role_recovery',
        outcome: 'success',
    })
    expect(queries.some(({ sql }) => sql.includes('UPDATE organization_members') && sql.includes('status = \'active\''))).toBe(true)
    expect(queries.some(({ sql }) => sql.includes('UPDATE organizations SET updated_at = NOW()'))).toBe(true)
})

test('support role recovery rechecks owner protection inside the membership transaction', async () => {
    supportOrganization = activeSupportOrganizationFixture()
    supportMemberRole = 'owner'
    supportOwnerCounts = [2, 1]

    const result = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: { role: 'reader', reason: 'Restore member access', scope: 'member:role_recovery', requestId: 'role-race-1' },
    })

    expect(result.statusCode).toBe(403)
    expect(result.body.detail.code).toBe('Support role recovery cannot demote the last active owner.')
    expect(result.body.detail.executorBlocker.blockers).toContain('Support role recovery cannot demote the last active owner.')
    expect(queries.some(({ sql }) => sql.includes('UPDATE organization_members') && sql.includes('SET role = $3'))).toBe(false)
    expect(recordedEvents.at(-1)).toMatchObject({
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
    expect(queries.some(({ sql }) => sql.includes('FROM users') && sql.includes('organization_members membership') && sql.includes('FOR UPDATE'))).toBe(true)
})

test('support role recovery locks active organization admins and rechecks their availability', async () => {
    supportOrganization = activeSupportOrganizationFixture()
    supportAvailabilityResults = [[], [{ organization_id: 'org-1', active_admin_count: 1 }]]

    const result = await request(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: 'member-1' },
        body: { role: 'reader', reason: 'Restore member access', scope: 'member:role_recovery', requestId: 'role-admin-race-1' },
    })

    expect(result.statusCode).toBe(409)
    expect(result.body.detail.code).toBe('active_admin_available')
    expect(queries.some(({ sql }) => sql.includes('membership.role IN (\'owner\', \'admin\')') && sql.includes('FOR UPDATE'))).toBe(true)
    expect(queries.some(({ sql }) => sql.includes('UPDATE organization_members') && sql.includes('SET role = $3'))).toBe(false)
})

test('access recovery search applies requester, approver, status, outcome, organization, and request filters', async () => {
    approvalRows = [{
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
    expect(queries).toHaveLength(1)
    expect(queries[0].sql).toContain('approval.request_id ILIKE')
    expect(queries[0].sql).toContain('approval.organization_id ILIKE')
    expect(queries[0].sql).toContain('approval.status =')
    expect(queries[0].sql).toContain('approval.outcome =')
    expect(queries[0].sql).toContain('approval.requested_by ILIKE')
    expect(queries[0].sql).toContain('approval.approved_by ILIKE')
    expect(queries[0].sql).toContain('approval.denied_by ILIKE')
    expect(queries[0].values).toEqual(['%recovery-1%', '%org-1%', 'pending', 'success', '%admin-one%', '%admin-two%', 20])
})
