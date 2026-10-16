import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, request, accessRecoveryApprovalFixture, supportRecoveryInviteFixture, postSupportAccessRecovery, postSupportAccessRecoveryApprove, postSupportAccessRecoveryDeny, activeSupportOrganizationFixture } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('approval-required access recovery holds its invite through the shared revoke contract', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportRecoveryInviteUpsert = supportRecoveryInviteFixture()
    state.supportRecoveryInviteResult = supportRecoveryInviteFixture({
        status: 'revoked', revoked_at: '2026-10-16T00:00:00.000Z',
    })

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
    state.supportRecoveryInviteUpsert = supportRecoveryInviteFixture()
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

