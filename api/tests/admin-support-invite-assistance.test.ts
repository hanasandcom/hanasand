import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, request, supportRecoveryInviteFixture, organizationInviteUpsertCalls, postSupportOrganizationInvite, postSupportOrganizationInviteAction, activeSupportOrganizationFixture } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('support invite action success keeps updated invite evidence in executor and receipt', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportRecoveryInviteResult = supportRecoveryInviteFixture({
        id: 'invite-1', email: 'member@example.com', role: 'reader', expires_at: '2026-12-01T00:00:00.000Z',
        invited_by: 'owner-1', created_at: '2026-10-01T00:00:00.000Z',
    })

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

test('support invite assistance allows an unavailable organization admin and returns its audited receipt', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportAvailabilityResults = [[{
        organization_id: 'org-1', owner_count: 1, active_owner_count: 0,
        admin_count: 1, active_admin_count: 0,
    }]]
    state.supportRecoveryInviteUpsert = supportRecoveryInviteFixture({
        id: 'assist-invite-1', email: 'member@example.com', role: 'reader',
    })

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
    expect(state.queries.find(({ sql }) => sql.includes('AS active_admin_count'))?.values).toEqual([['org-1']])
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
