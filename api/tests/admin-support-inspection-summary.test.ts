import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'
import { uniqueTimelineValues } from '../src/utils/support/inspectionPackets.ts'

const { state, request, getSupportInspection, getSupportOrganization, getSupportUser, supportInviteInspectionFixture } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('support inspection keeps organization member and pending-invite counts in its response', async () => {
    state.supportOrganization = {
        id: 'org-1', name: 'Org', slug: 'org', status: 'active',
        member_count: 3, pending_invite_count: 2,
    }

    const response = await request(getSupportInspection, { query: { org: 'org-1' } })

    expect(response.statusCode).toBe(200)
    const approvalQuery = state.queries.find(({ sql }) => sql.includes('FROM admin_access_recovery_approvals approval'))
    expect(approvalQuery?.sql).toContain('invite.status AS invite_status')
    expect(approvalQuery?.sql).toContain('AS audit_events')
    expect(response.body.inspection.organizations).toHaveLength(1)
    expect(response.body.inspection.organizations[0]).toMatchObject({
        id: 'org-1',
        memberCount: 3,
        pendingInviteCount: 2,
    })
    const inspection = response.body.inspection
    for (const proof of [
        'searchProof',
        'auditFilterCoverage',
        'actionAuditContract',
        'enterpriseReadiness',
        'negativeCaseMatrix',
        'approvalDecisionPacket',
        'receiptReplayPacket',
        'sessionReplayReceipt',
        'replayExportPacket',
    ]) {
        expect(inspection[proof]).toBeDefined()
        expect(inspection.filteredTimeline[proof]).toEqual(inspection[proof])
    }

    const detail = await request(getSupportOrganization, { params: { id: 'org-1' } })
    expect(detail.statusCode).toBe(200)
    expect(detail.body.organization).toMatchObject({
        id: 'org-1',
        memberCount: 3,
        pendingInviteCount: 2,
    })
})

test('organization and user inspections keep shared fields and target-specific contracts', async () => {
    state.supportOrganization = {
        id: 'org-1', name: 'Org', slug: 'org', status: 'active',
        member_count: 3, pending_invite_count: 2,
    }
    state.supportUser = {
        id: 'user-1', name: 'User One', avatar: null, email: 'member@example.com', active: true, reserved: false,
        deactivated_at: null, deactivated_by: null, deletion_requested_at: null, deletion_scheduled_at: null,
    }

    const organizationResponse = await request(getSupportOrganization, { params: { id: 'org-1' } })
    const userResponse = await request(getSupportUser, { params: { id: 'user-1' } })

    expect(state.recordedEvents.map(({ actionType, targetType, targetId }) => ({ actionType, targetType, targetId }))).toEqual([
        { actionType: 'support.organization.inspect', targetType: 'organization', targetId: 'org-1' },
        { actionType: 'support.user.inspect', targetType: 'user', targetId: 'user-1' },
    ])

    expect(organizationResponse.statusCode).toBe(200)
    expect(userResponse.statusCode).toBe(200)
    const organization = organizationResponse.body
    const user = userResponse.body
    const sharedFields = [
        'authorization', 'accessStatus', 'accessRecoveryPlan', 'inspectionReceipt',
        'actionHistoryReceipt', 'actionHistoryExport', 'caseAccessReadiness', 'caseHandoff',
        'supportActivityRollup', 'recentAuditEvents', 'recentAuditTimeline', 'copyText',
    ]
    for (const field of sharedFields) {
        expect(Object.hasOwn(organization, field)).toBe(true)
        expect(Object.hasOwn(user, field)).toBe(true)
    }

    expect(organization).toMatchObject({
        organization: { id: 'org-1' },
        inspectionReceipt: { schemaVersion: 'support.organization.inspection_receipt.v1' },
        caseAccessReadiness: { schemaVersion: 'support.case_access_readiness.v1' },
        caseHandoff: { schemaVersion: 'support.organization.case_handoff.v1' },
        supportActivityRollup: { schemaVersion: 'support.organization.activity_rollup.v1' },
        members: [],
        invites: [],
        watchlistItems: [],
        webhookDestinations: [],
        recentAuditEvents: [],
    })
    expect(organization.copyText).toBe([
        'Support organization inspection org-1',
        'Authorization: support role',
        `Access status: ${organization.accessStatus.overall}`,
        'Members: 0',
        'Pending invites: 0',
        'Audit events: none',
    ].join('\n'))

    expect(user).toMatchObject({
        user: { id: 'user-1', name: 'User One' },
        inspectionReceipt: { schemaVersion: 'support.user.inspection_receipt.v1' },
        caseAccessReadiness: { schemaVersion: 'support.user_case_access_readiness.v1' },
        caseHandoff: { schemaVersion: 'support.user.case_handoff.v1' },
        supportActivityRollup: { schemaVersion: 'support.user.activity_rollup.v1' },
        memberships: [],
        pendingInvites: [],
        approvalRequests: [],
        recentAuditEvents: [],
    })
    expect(user.copyText).toBe([
        'Support user inspection user-1',
        'Authorization: support role',
        `Access status: ${user.accessStatus.overall}`,
        'Memberships: 0',
        'Pending invites: 0',
        'Audit events: none',
    ].join('\n'))
    for (const subject of [organization, user]) {
        expect(subject.caseAccessReadiness.recoveryState).toEqual({
            accessStatus: subject.accessStatus.overall || null,
            recoveryAvailable: Boolean(subject.accessRecoveryPlan.available || subject.accessRecoveryPlan.items?.length),
            blockers: uniqueTimelineValues([
                ...(Array.isArray(subject.accessStatus.blockers) ? subject.accessStatus.blockers : []),
                ...(Array.isArray(subject.accessRecoveryPlan.blockers) ? subject.accessRecoveryPlan.blockers : []),
            ]),
        })
    }
    expect(organization.recentAuditEvents).toBe(organization.recentAuditTimeline.events)
    expect(user.recentAuditEvents).toBe(user.recentAuditTimeline.events)
    expect(organization).not.toHaveProperty('user')
    expect(user).not.toHaveProperty('organization')
})

test('user inspection finds pending organization invites by the user email', async () => {
    state.supportUser = {
        id: 'user-1', name: 'User One', avatar: null, email: 'member@example.com', active: true, reserved: false,
        deactivated_at: null, deactivated_by: null, deletion_requested_at: null, deletion_scheduled_at: null,
    }
    state.supportUserInvites = [supportInviteInspectionFixture()]

    const response = await request(getSupportUser, { params: { id: 'user-1' } })

    expect(response.statusCode).toBe(200)
    expect(response.body.pendingInvites).toMatchObject([{ id: 'invite-1', email: 'member@example.com' }])
    expect(response.body.copyText).toContain('Pending invites: 1')
    expect(response.body.caseAccessReadiness.evidence).toMatchObject({ activeMembershipCount: 0, removedMembershipCount: 0, pendingInviteCount: 1, approvalRequestCount: 0 })
    expect(response.body.caseHandoff.evidence).toMatchObject({ membershipCount: 0, activeMembershipCount: 0, pendingInviteCount: 1, approvalRequestCount: 0 })
    const inviteQuery = state.queries.find(({ sql }) => sql.includes('lower(organization_invites.email) = lower($1)'))
    expect(inviteQuery?.values).toEqual(['member@example.com'])
})

test('missing organization and user inspections preserve 404 audit contracts', async () => {
    state.supportOrganization = null
    const missingOrganization = await request(getSupportOrganization, { params: { id: 'missing-org' } })

    expect(missingOrganization.statusCode).toBe(404)
    expect(missingOrganization.body).toEqual({ error: 'Organization not found.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.organization.inspect',
        targetType: 'organization',
        targetId: 'missing-org',
        organizationId: 'missing-org',
        entityId: 'missing-org',
        outcome: 'failed',
        context: { error: 'organization_not_found' },
    })

    state.recordedEvents.length = 0
    state.supportUser = null
    const missingUser = await request(getSupportUser, { params: { id: 'missing-user' } })

    expect(missingUser.statusCode).toBe(404)
    expect(missingUser.body).toEqual({ error: 'User not found.' })
    expect(state.recordedEvents.at(-1)).toMatchObject({
        actionType: 'support.user.inspect',
        targetType: 'user',
        targetId: 'missing-user',
        entityId: 'missing-user',
        outcome: 'failed',
        context: { error: 'user_not_found' },
    })
    expect(state.recordedEvents.at(-1)).not.toHaveProperty('organizationId')
})
