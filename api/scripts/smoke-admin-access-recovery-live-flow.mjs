import { seedSmoke } from './smoke-admin-access-recovery-live-fixture.mjs'
import { createSmokeClient } from './smoke-admin-access-recovery-live-client.mjs'

export async function runAdminAccessRecoverySmoke(context) {
    const client = createSmokeClient(context)
    await context.pool.query('SELECT 1')
    await seedSmoke(context, client)
    await client.verifyUnauthorizedSearchIsBlocked()

    const approveRecovery = await client.createRecovery(context.approveRequestId, `support-${context.suffix}-approve@example.test`)
    const inspection = await client.inspectSupportState({
        org: context.orgId,
        email: approveRecovery.invite.email,
        request: context.approveRequestId,
        outcome: 'success',
    })
    expect(inspection.pendingInvites.length === 0, 'Pending high-risk inspection should not expose a shareable invite before approval.', inspection)
    expect(inspection.invites[0]?.status === 'revoked', 'Inspection should show the high-risk invite as revoked until approved.', inspection)
    let approvals = await client.searchApproval({ request: context.approveRequestId, status: 'pending_approval', outcome: 'success' })
    expect(approvals[0].invite.status === 'revoked', 'Pending approval search should show revoked invite.', approvals[0])
    expect((approvals[0].auditEventIds || []).length > 0, 'Pending approval search should include audit event ids.', approvals[0])

    const approved = await client.decide(context.approveRequestId, 'approve', 'approved')
    expect(approved.approvedBy === context.adminTwoId, 'Approval should record approving admin.', approved)
    approvals = await client.searchApproval({
        request: context.approveRequestId,
        status: 'approved',
        outcome: 'success',
        requester: context.adminOneId,
        approver: context.adminTwoId,
    })
    expect(approvals[0].invite.status === 'pending', 'Approved recovery should re-enable invite as pending.', approvals[0])
    expect((approvals[0].auditEventIds || []).length >= 2, 'Approved recovery search should include create and approve audit ids.', approvals[0])
    await client.verifyUnauthorizedInviteActionIsBlocked(approveRecovery.invite.id)

    const revokeRequestId = `${context.approveRequestId}-invite-revoke`
    const resendRequestId = `${context.approveRequestId}-invite-resend`
    const revokedInvite = await client.supportInviteAction(approveRecovery.invite.id, 'revoke', revokeRequestId)
    expect(revokedInvite.invite.status === 'revoked', 'Support invite revoke should mark the invite revoked.', revokedInvite)
    const resentInvite = await client.supportInviteAction(approveRecovery.invite.id, 'resend', resendRequestId)
    expect(resentInvite.invite.status === 'pending', 'Support invite resend should re-enable the invite as pending.', resentInvite)
    const inviteTimeline = await client.inspectSupportState({
        request: resendRequestId,
        entity: approveRecovery.invite.id,
        entityType: 'invite',
        action: 'invite_resend',
        outcome: 'success',
    })
    expect(inviteTimeline.auditTimeline[0]?.action?.includes('invite_resend'), 'Support inspection should filter invite action timeline by request/entity/action/outcome.', inviteTimeline)

    const denialRecovery = await verifyDenial(context, client)
    printResult(context, approveRecovery, denialRecovery)
}

async function verifyDenial(context, client) {
    const denialRecovery = await client.createRecovery(context.denyRequestId, `support-${context.suffix}-deny@example.test`)
    expect(denialRecovery.invite.status === 'revoked', 'Deny flow should start with revoked invite.', denialRecovery)
    const denied = await client.decide(context.denyRequestId, 'deny', 'denied')
    expect(denied.deniedBy === context.adminTwoId, 'Denial should record denying admin.', denied)
    const approvals = await client.searchApproval({
        request: context.denyRequestId,
        status: 'denied',
        outcome: 'denied',
        requester: context.adminOneId,
        approver: context.adminTwoId,
    })
    expect(approvals[0].invite.status === 'revoked', 'Denied recovery should keep invite revoked.', approvals[0])
    expect((approvals[0].auditEventIds || []).length >= 2, 'Denied recovery search should include create and deny audit ids.', approvals[0])
    return denialRecovery
}

function printResult(context, approveRecovery, denialRecovery) {
    console.log('Admin access recovery live smoke passed.')
    console.log(JSON.stringify({
        schemaVersion: 'support.access_recovery.live_smoke_result.v1',
        orgId: context.orgId,
        approveRequestId: context.approveRequestId,
        denyRequestId: context.denyRequestId,
        approveInviteId: approveRecovery.invite.id,
        denyInviteId: denialRecovery.invite.id,
        inviteActionAudit: `/api/admin/support/inspect?request=${encodeURIComponent(`${context.approveRequestId}-invite-resend`)}&entity=${encodeURIComponent(approveRecovery.invite.id)}&action=invite_resend&outcome=success`,
        auditSearch: `/api/admin/support/access-recovery?request=${encodeURIComponent(context.approveRequestId)}&status=approved&outcome=success`,
    }, null, 2))
}

function expect(condition, message, details) {
    if (condition) return
    const error = new Error(message)
    if (details !== undefined) error.details = details
    throw error
}
