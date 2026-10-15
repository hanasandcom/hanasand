import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'

let actor = { valid: true, id: 'support-admin', impersonating: false }
let internalAccess = true
let eventRows: Record<string, any>[] = []
let approvalRows: Record<string, any>[] = []
let supportOrganization: Record<string, any> | null = null
let supportInviteReads = 0
let inviteActionWrites = 0
let acceptedInviteWinsRace = false
const queries: Array<{ sql: string, values: unknown[] }> = []

async function run(sql: string, values: unknown[] = []) {
    queries.push({ sql, values })
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
            name: 'Member', avatar: null, active: true, role: 'editor', status: 'active', invited_by: 'owner-1',
            joined_at: '2026-10-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        }] }
    }
    if (sql.includes('FROM organization_members membership')) return { rows: [{ owner_count: 2 }] }
    if (sql.includes('active_admin_count')) return { rows: [] }
    if (sql.includes('context->>\'idempotencyKey\'') && sql.includes('outcome = \'success\'')) return { rows: [] }
    if (sql.includes('WHERE request_id = $1') && sql.includes('event_type = $2') && sql.includes('subject_id = $3')) return { rows: [{ id: 91 }] }
    if (sql.includes('UPDATE organization_members') && sql.includes('SET role = $3')) return { rows: [{
        organization_id: 'org-1', user_id: 'member-1', role: 'reader', status: 'active',
    }] }
    if (sql.includes('FROM admin_access_recovery_approvals approval')) return { rows: approvalRows }
    if (sql.includes('SELECT COUNT(*)::int AS total')) return { rows: [{ total: eventRows.length }] }
    if (sql.includes('FROM system_events e') && sql.includes('WHERE e.id = $1')) return { rows: eventRows }
    if (sql.includes('FROM system_events e')) return { rows: eventRows }
    return { rows: [] }
}

const recordedEvents: Array<Record<string, unknown>> = []
const systemEventUtils = await import('../src/utils/systemEvent.ts')
mock.module('../src/utils/db.ts', () => ({ default: run, queryOnce: run, identityQueryOnce: run, closeDatabase: async () => {} }))
const identityDataWrites = await import('../src/utils/db/identityDataWrites.ts')
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => actor }))
mock.module('../src/utils/systemEvent.ts', () => ({
    ...systemEventUtils,
    actorHasHanasandInternalAccess: async () => internalAccess,
    recordSystemEvent: async (_req: unknown, event: Record<string, unknown>) => { recordedEvents.push(event) },
}))
mock.module('../src/utils/db/identityDataWrites.ts', () => ({
    upsertAdminAccessRecoveryApproval: async () => {},
    upsertOrganizationInvite: async () => {},
    updateOrganizationInviteAction: async () => { inviteActionWrites += 1; return null },
    updateActiveOrganizationMemberRole: identityDataWrites.updateActiveOrganizationMemberRole,
}))

const {
    getSystemEvents,
    getSystemEvent,
    getSupportAccessRecoveryApprovals,
    getSupportInspection,
    getSupportOrganization,
    postSupportOrganizationInviteAction,
    postSupportOrganizationMemberRoleRecovery,
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

beforeEach(() => {
    actor = { valid: true, id: 'support-admin', impersonating: false }
    internalAccess = true
    eventRows = []
    approvalRows = []
    supportOrganization = null
    supportInviteReads = 0
    inviteActionWrites = 0
    acceptedInviteWinsRace = false
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
        password: '[redacted]',
        nested: { apiToken: '[redacted]', safe: 'kept' },
        webhookUrl: '[redacted]',
    })
    expect(event.detail.timelineEvent.context).toEqual(event.context)
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

test('support invite action returns an audited accepted-invite denial when acceptance wins the update race', async () => {
    supportOrganization = { id: 'org-1', name: 'Org', slug: 'org', status: 'active' }
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

test('support role recovery shares the active-member write and retains its audited receipt', async () => {
    supportOrganization = { id: 'org-1', name: 'Org', slug: 'org', status: 'active' }

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
