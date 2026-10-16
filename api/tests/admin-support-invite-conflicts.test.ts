import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, run, request, postSupportOrganizationInvite, postSupportOrganizationInviteAction, postSupportOrganizationMemberRoleRecovery, activeSupportOrganizationFixture, supportInviteInspectionFixture } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
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

test('support invite action audits an expired accepted invite before validating resend expiry', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionInvite = {
        ...supportInviteInspectionFixture(),
        status: 'accepted',
        expires_at: '2020-01-01T00:00:00.000Z',
    }

    const result = await request(postSupportOrganizationInviteAction, { params: { id: 'org-1', inviteId: 'invite-1' }, body: { action: 'resend', reason: 'Restore access', scope: 'invite:resend' } })

    expect(result.statusCode).toBe(409)
    expect(state.inviteActionWrites).toBe(1)
    expect(result.body.inviteAction).toMatchObject({
        schemaVersion: 'support.invite_action.v1',
        outcome: 'failed',
        before: { status: 'accepted' },
        after: { status: 'accepted' },
    })
    expect(state.inviteActionInputs.at(-1)).toMatchObject({
        action: 'resend',
        expiresAt: '2020-01-01T00:00:00.000Z',
    })
    expect(state.recordedEvents.at(-1)?.context).toMatchObject({
        error: 'accepted_invite_not_mutable_by_support_action',
        noSilentMembershipMutation: true,
    })
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

