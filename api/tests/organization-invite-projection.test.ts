import { expect, test } from 'bun:test'
import { organizationInviteAcceptanceReference, toInvite } from '../src/utils/organizations.ts'

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
