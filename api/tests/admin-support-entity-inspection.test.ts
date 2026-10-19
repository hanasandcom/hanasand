import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, request, getSupportOrganizationInvite, getSupportOrganizationMember, activeSupportOrganizationFixture, supportInviteInspectionFixture, supportMemberInspectionFixture, supportInspectionAuditFixture, expectInspectionAuditQuery } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('support invite inspection retains its organization-scoped audit and response contract', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionInvite = supportInviteInspectionFixture()
    state.supportInspectionAuditRows = [supportInspectionAuditFixture('invite-1')]

    const response = await request(getSupportOrganizationInvite, { params: { id: 'org-1', inviteId: 'invite-1' } })

    expect(response.statusCode).toBe(200)
    expect(response.body.invite).toMatchObject({ id: 'invite-1', organizationId: 'org-1', email: 'member@example.com' })
    expect(response.body.inviteInspection).toMatchObject({
        schemaVersion: 'support.invite_inspection.v1',
        organization: { id: 'org-1' },
        invite: { id: 'invite-1', email: 'member@example.com' },
        snapshot: { id: 'invite-1', status: 'pending' },
        authorization: {
            requested: { organizationId: 'org-1', entityId: 'invite-1' },
            effective: { organizationId: 'org-1', email: 'member@example.com', entityId: 'invite-1' },
        },
        caseHandoff: {
            schemaVersion: 'support.invite.case_handoff.v1',
            inviteId: 'invite-1', targetEmail: 'member@example.com',
            evidence: { inviteStatus: 'pending', inviteRole: 'reader', auditEventIds: [71] },
            inviteActions: {
                resend: { requiredScope: 'invite:resend', reasonRequired: true, idempotencyRequired: true },
                revoke: { requiredScope: 'invite:revoke', reasonRequired: true, idempotencyRequired: true },
            },
            safeHandoff: { noLiveAccessGrant: true, noSilentMembershipMutation: true, noCrossOrgLeakage: true, redactionRequired: true },
        },
        auditEventIds: [71],
        auditTimeline: { eventIds: [71] },
        links: {
            action: '/api/admin/support/organizations/org-1/invites/invite-1/actions',
            accessRecovery: '/api/admin/support/organizations/org-1/access-recovery',
            audit: '/api/admin/audit-events?org=org-1&entity=invite-1&entityType=invite',
        },
        noMutation: true,
        redacted: true,
    })
    expectInspectionAuditQuery('invite-1', [
        'event.context->>\'inviteId\' = $2',
        'event.context->\'inviteIds\' ? $2',
    ])
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite.inspect', targetType: 'invite', targetId: 'member@example.com',
        organizationId: 'org-1', entityId: 'invite-1', outcome: 'success',
        context: { inviteId: 'invite-1', email: 'member@example.com', status: 'pending', role: 'reader' },
    })
})

test('support member inspection retains its organization-scoped audit and response contract', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionMember = supportMemberInspectionFixture()
    state.supportInspectionAuditRows = [supportInspectionAuditFixture('member-1')]

    const response = await request(getSupportOrganizationMember, { params: { id: 'org-1', userId: 'member-1' } })

    expect(response.statusCode).toBe(200)
    expect(response.body.member).toMatchObject({ organizationId: 'org-1', userId: 'member-1', role: 'editor' })
    expect(response.body.memberInspection).toMatchObject({
        schemaVersion: 'support.member_inspection.v1',
        organization: { id: 'org-1' },
        member: { organizationId: 'org-1', userId: 'member-1', role: 'editor' },
        snapshot: { organizationId: 'org-1', userId: 'member-1', role: 'editor', status: 'active', active: true },
        authorization: {
            requested: { organizationId: 'org-1', userId: 'member-1', entityId: 'member-1' },
            effective: { organizationId: 'org-1', userId: 'member-1', entityId: 'member-1' },
        },
        caseHandoff: {
            schemaVersion: 'support.member.case_handoff.v1',
            userId: 'member-1',
            evidence: { role: 'editor', status: 'active', active: true, auditEventIds: [71] },
            recovery: { roleRecoveryAvailable: true },
            memberActions: {
                roleRecovery: { requiredScope: 'member:role_recovery', reasonRequired: true, idempotencyRequired: true },
                inspectUser: '/api/admin/support/users/member-1',
            },
            safeHandoff: { noLiveAccessGrant: true, noSilentMembershipMutation: true, noCrossOrgLeakage: true, redactionRequired: true },
        },
        auditEventIds: [71],
        auditTimeline: { eventIds: [71] },
        links: {
            roleRecovery: '/api/admin/support/organizations/org-1/members/member-1/role-recovery',
            audit: '/api/admin/audit-events?org=org-1&target=member-1&entity=member-1&entityType=member',
            user: '/api/admin/support/users/member-1',
        },
        noMutation: true,
        redacted: true,
    })
    expectInspectionAuditQuery('member-1', [
        'event.context->>\'targetUserId\' = $2',
        'event.context->>\'memberId\' = $2',
    ])
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member.inspect', targetType: 'member', targetId: 'member-1',
        organizationId: 'org-1', entityId: 'member-1', outcome: 'success',
        context: { userId: 'member-1', role: 'editor', status: 'active', active: true },
    })
})

test('support invite and member inspection audit missing organizations and targets separately', async () => {
    const missingInviteOrganization = await request(getSupportOrganizationInvite, { params: { id: 'missing-org', inviteId: 'invite-1' } })
    expect(missingInviteOrganization.statusCode).toBe(404)
    expect(missingInviteOrganization.body).toEqual({ error: 'Organization not found.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite.inspect', organizationId: 'missing-org',
        context: { error: 'organization_not_found', inviteId: 'invite-1' },
    })
    expect(state.queries).toHaveLength(1)

    state.queries.length = 0
    state.recordedEvents.length = 0
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionInvite = null
    const missingInvite = await request(getSupportOrganizationInvite, { params: { id: 'org-1', inviteId: 'missing-invite' } })
    expect(missingInvite.statusCode).toBe(404)
    expect(missingInvite.body).toEqual({ error: 'Invite not found for organization.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.invite.inspect', organizationId: 'org-1',
        context: { error: 'invite_not_found', inviteId: 'missing-invite' },
    })
    expect(state.queries).toHaveLength(2)
    expect(state.queries[1].values).toEqual(['missing-invite', 'org-1'])

    state.queries.length = 0
    state.recordedEvents.length = 0
    state.supportOrganization = null
    const missingMemberOrganization = await request(getSupportOrganizationMember, { params: { id: 'missing-org', userId: 'member-1' } })
    expect(missingMemberOrganization.statusCode).toBe(404)
    expect(missingMemberOrganization.body).toEqual({ error: 'Organization not found.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member.inspect', organizationId: 'missing-org',
        context: { error: 'organization_not_found', userId: 'member-1' },
    })
    expect(state.queries).toHaveLength(1)

    state.queries.length = 0
    state.recordedEvents.length = 0
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportInspectionMember = null
    const missingMember = await request(getSupportOrganizationMember, { params: { id: 'org-1', userId: 'missing-member' } })
    expect(missingMember.statusCode).toBe(404)
    expect(missingMember.body).toEqual({ error: 'Organization member not found.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.member.inspect', organizationId: 'org-1',
        context: { error: 'member_not_found', userId: 'missing-member' },
    })
    expect(state.queries).toHaveLength(2)
    expect(state.queries[1].values).toEqual(['org-1', 'missing-member'])
})
