import { expect, test } from 'bun:test'
import { organizationInviteAcceptanceReference, toInvite } from '../src/utils/organizations.ts'
import { buildOrganizationInviteActionReceipt } from '../src/handlers/organizations/invites/actionReceipt.ts'
import { buildOrganizationInviteAcceptanceResponse, type AcceptedInviteRow } from '../src/handlers/organizations/invites/acceptanceReceipt.ts'

test('invite acceptance references encode the invite id and keep the response fields together', () => {
    const inviteId = 'invite/a?b+c'
    const reference = organizationInviteAcceptanceReference(inviteId)

    expect(reference).toEqual({
        acceptanceToken: inviteId,
        acceptancePath: '/api/organizations/invites/invite%2Fa%3Fb%2Bc/accept',
    })

    const invite = toInvite({
        id: inviteId,
        organization_id: 'org-1',
        email: 'member@example.test',
        role: 'reader',
        invited_by: 'owner-1',
        status: 'pending',
        created_at: '2026-10-01T00:00:00.000Z',
        expires_at: '2026-11-01T00:00:00.000Z',
    })

    expect(Object.keys(invite)).toEqual([
        'id', 'organizationId', 'tenantId', 'acceptanceToken', 'acceptancePath',
        'email', 'role', 'invitedBy', 'acceptedBy', 'status', 'createdAt', 'expiresAt', 'acceptedAt',
    ])
    expect(invite).toMatchObject(reference)
})

test('invite action receipt preserves lifecycle and downstream denial contracts', () => {
    const receipt = buildOrganizationInviteActionReceipt({
        organizationId: 'org-1',
        actorId: 'owner-1',
        actorRole: 'owner',
        invite: {
            id: 'invite-1', organization_id: 'org-1', email: 'member@example.test', role: 'reader',
            invited_by: 'owner-1', status: 'revoked', created_at: '2026-10-01T00:00:00Z',
        },
        action: 'revoke',
        previousStatus: 'pending',
        reason: 'No longer needed.',
        requestId: 'request-1',
        serviceLogAction: 'organization_invite_revoked',
    })

    expect(receipt).toMatchObject({
        schemaVersion: 'organization.invite_action.v1',
        organizationId: 'org-1',
        actorId: 'owner-1',
        action: 'revoke',
        previousStatus: 'pending',
        status: 'revoked',
        requestId: 'request-1',
        serviceLogAction: 'organization_invite_revoked',
        consumerVisibilityReceipt: { grantsConsumerAccess: false, blockerCode: 'member_revoked' },
        downstreamReadinessReceipt: {
            grantsConsumerAccess: false,
            blockerReason: 'member_revoked',
            readiness: { supportRedactedReadReady: true, sharedWatchlistReadReady: false },
        },
    })
    expect(receipt.downstreamReadinessReceipt.requiredAcceptedMembershipFields).toContain('member.userId')
})

test('invite acceptance response preserves membership and accepted-access receipts', () => {
    const row: AcceptedInviteRow = {
        invite_id: 'invite-1', organization_id: 'org-1', email: 'member@example.test', invite_role: 'admin',
        invited_by: 'owner-1', accepted_by: 'member-1', invite_status: 'accepted',
        invite_created_at: '2026-10-01T00:00:00Z', accepted_at: '2026-10-16T12:00:00Z',
        expires_at: '2026-11-01T00:00:00Z', user_id: 'member-1', member_role: 'admin',
        member_status: 'active', joined_at: '2026-10-16T12:00:00Z', member_created_at: '2026-10-16T12:00:00Z',
    }
    const response = buildOrganizationInviteAcceptanceResponse({
        row,
        userId: 'member-1',
        serviceLogAction: 'organization_invite_accepted',
        organization: undefined,
    })

    expect(response.invite).toMatchObject({ id: 'invite-1', status: 'accepted', role: 'admin' })
    expect(response.membership).toEqual({
        organizationId: 'org-1', userId: 'member-1', role: 'admin', status: 'active',
        joinedAt: row.joined_at, createdAt: row.member_created_at,
    })
    expect(response.inviteAcceptance.consumerVisibilityReceipt).toMatchObject({
        action: 'accept', grantsConsumerAccess: true, membershipStatus: 'active',
        roleGates: { canReadSharedWatchlists: true, canExportAlertTerms: true },
        downstreamReadinessGrant: { sharedWatchlistReadReady: true, webhookDeliveryReady: true },
    })
    expect(response.organization).toBeNull()
})
