import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, request, getSupportAccessRecoveryApprovals, postSupportOrganizationMemberRoleRecovery, activeSupportOrganizationFixture } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
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
