import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney, Row } from './harness.ts'

export async function runInviteBulkAndAcceptance(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, invites, authHeaders, parseBody, nowRow } = ctx
    const { organization } = journey

    const bulkEmails = Array.from({ length: 10 }, (_, index) => `bulk-${index + 1}@example.test`)
    const bulkInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: {
            emails: bulkEmails,
            role: 'member',
            requestId: 'smoke-bulk-10',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
    }, 201)
    const bulkInviteWorkflow = journey.bulkInviteWorkflow = parseBody(bulkInviteResponse.body).workflow
    assert.equal(bulkInviteWorkflow.schemaVersion, 'organization.bulk_invite.v1')
    assert.equal(bulkInviteWorkflow.requestId, 'smoke-bulk-10')
    assert.equal(bulkInviteWorkflow.actorId, 'org_smoke_admin')
    assert.equal(bulkInviteWorkflow.organizationId, organization.id)
    assert.equal(bulkInviteWorkflow.submittedRecipientCount, 10)
    assert.equal(bulkInviteWorkflow.recipientCount, 10)
    assert.equal(bulkInviteWorkflow.normalizedRecipientCount, 10)
    assert.equal(bulkInviteWorkflow.duplicateRecipientCount, 0)
    assert.equal(bulkInviteWorkflow.invitedCount, 10)
    assert.equal(bulkInviteWorkflow.skippedCount, 0)
    assert.equal(bulkInviteWorkflow.expiresAt, parseBody(bulkInviteResponse.body).invites[0].expiresAt)
    assert.deepEqual(bulkInviteWorkflow.results.map((result: Row) => result.outcome), Array(10).fill('invited'))
    assert.ok(bulkInviteWorkflow.results.every((result: Row) => result.acceptanceToken === result.inviteId))
    assert.ok(bulkInviteWorkflow.results.every((result: Row) => result.acceptancePath === `/api/organizations/invites/${result.inviteId}/accept`))

    const duplicateBulkInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: bulkEmails[0], role: 'viewer', request_id: 'smoke-duplicate-bulk' },
    }, 201)
    const duplicateInviteWorkflow = parseBody(duplicateBulkInviteResponse.body).workflow
    assert.equal(duplicateInviteWorkflow.duplicateInviteCount, 1)
    assert.equal(duplicateInviteWorkflow.results[0].outcome, 'updated_pending_invite')
    assert.equal(duplicateInviteWorkflow.results[0].email, bulkEmails[0])

    const deactivatedInviteResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: { email: 'deactivated@example.test', role: 'member', requestId: 'smoke-deactivated-invite' },
    }, 201)
    const deactivatedWorkflow = parseBody(deactivatedInviteResponse.body).workflow
    assert.equal(deactivatedWorkflow.invitedCount, 0)
    assert.equal(deactivatedWorkflow.skippedCount, 1)
    assert.equal(deactivatedWorkflow.results[0].outcome, 'blocked_deactivated_user')

    const staleDeactivatedInvite = journey.staleDeactivatedInvite = nowRow({
        id: 'stale-deactivated-invite',
        organization_id: organization.id,
        email: 'deactivated@example.test',
        role: 'member',
        invited_by: 'org_smoke_owner',
        status: 'pending',
        accepted_at: null,
        accepted_by: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    invites.set(staleDeactivatedInvite.id, staleDeactivatedInvite)
    const staleDeactivatedAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${staleDeactivatedInvite.id}/accept`,
        headers: authHeaders('org_smoke_deactivated', 'deactivated-token'),
    }, 409)
    const staleDeactivatedAcceptDenial = parseBody(staleDeactivatedAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(staleDeactivatedAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assert.equal(staleDeactivatedAcceptDenial.organizationId, organization.id)
    assert.equal(staleDeactivatedAcceptDenial.inviteId, staleDeactivatedInvite.id)
    assert.equal(staleDeactivatedAcceptDenial.inviteStatus, 'pending')
    assert.equal(staleDeactivatedAcceptDenial.userActive, false)
    assert.equal(staleDeactivatedAcceptDenial.blockerCode, 'member_deactivated')
    assert.equal(staleDeactivatedAcceptDenial.deactivatedUserDenied, true)
    assert.equal(staleDeactivatedAcceptDenial.nonmemberEnumeration, false)
    assert.ok(staleDeactivatedAcceptDenial.safeFields.includes('userActive'))

    const unknownUserInvite = journey.unknownUserInvite = nowRow({
        id: 'unknown-user-invite',
        organization_id: organization.id,
        email: 'unknown@example.test',
        role: 'reader',
        invited_by: 'org_smoke_owner',
        status: 'pending',
        accepted_at: null,
        accepted_by: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    invites.set(unknownUserInvite.id, unknownUserInvite)
    const unknownUserAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${unknownUserInvite.id}/accept`,
        headers: authHeaders('org_smoke_unknown', 'unknown-token'),
    }, 409)
    const unknownUserAcceptDenial = parseBody(unknownUserAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(unknownUserAcceptDenial.inviteStatus, 'pending')
    assert.equal(unknownUserAcceptDenial.userActive, null)
    assert.equal(unknownUserAcceptDenial.blockerCode, 'invite_not_pending')
    assert.equal(invites.get(unknownUserInvite.id).status, 'pending')
    invites.delete(unknownUserInvite.id)

    const expiredInvite = journey.expiredInvite = nowRow({
        id: 'expired-invite',
        organization_id: organization.id,
        email: 'expired@example.test',
        role: 'member',
        invited_by: 'org_smoke_owner',
        status: 'pending',
        accepted_at: null,
        accepted_by: null,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    invites.set(expiredInvite.id, expiredInvite)
    const expiredAcceptResponse = await apiRequest({
        method: 'POST',
        url: `/api/organizations/invites/${expiredInvite.id}/accept`,
        headers: authHeaders('org_smoke_expired', 'expired-token'),
    }, 409)
    const expiredAcceptDenial = parseBody(expiredAcceptResponse.body).inviteAcceptanceDenial
    assert.equal(expiredAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
    assert.equal(expiredAcceptDenial.organizationId, organization.id)
    assert.equal(expiredAcceptDenial.inviteId, expiredInvite.id)
    assert.equal(expiredAcceptDenial.inviteStatus, 'pending')
    assert.equal(expiredAcceptDenial.blockerCode, 'invite_expired')
    assert.ok(expiredAcceptDenial.blockedRoutes.includes('GET /api/organizations/:id/alert-case-visibility'))
    assert.ok(expiredAcceptDenial.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
    assert.equal(expiredAcceptDenial.readinessRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
    assert.equal(expiredAcceptDenial.ownerlessRecoveryMutationAllowed, false)
    assert.ok(expiredAcceptDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
    assert.equal(expiredAcceptDenial.nonmemberEnumeration, false)

}
