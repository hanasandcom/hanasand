import { expect, test } from 'bun:test'
import {
    buildSupportSubjectAccessState,
    buildSupportSubjectInspectionContext,
    buildSupportSubjectInspectionAuthorization,
    buildSupportSubjectInspectionReceipts,
} from '../src/handlers/adminSupport.ts'

const organizationId = 'org-1'
const userId = 'user-1'
const requestId = 'request-1'
const timeline = [{ id: 7, action: 'support.inspect', outcome: 'success', severity: 'info', requestId }]
const availabilityByOrg = new Map([[organizationId, {
    organizationId,
    ownerCount: 1,
    activeOwnerCount: 1,
    adminCount: 1,
    activeAdminCount: 1,
    hasAvailableOwner: true,
    hasAvailableAdmin: true,
}]])

function buildSubjectState(kind: 'organization' | 'user', organizationIds = [organizationId]) {
    const member = {
        id: userId,
        user_id: userId,
        organization_id: organizationId,
        active: true,
        status: 'active',
        role: 'owner',
    }
    return buildSupportSubjectAccessState({
        kind,
        targetId: kind === 'organization' ? organizationId : userId,
        organizationIds,
        requestId,
        reason: 'Customer requested access review',
        supportContext: 'Case 123',
        users: kind === 'organization' ? [member] : [{ id: userId, active: true }],
        memberships: [member],
        invites: [],
        approvalDetails: [],
        availabilityByOrg,
        timeline,
    })
}

function buildReceipts(kind: 'organization' | 'user', organizationIds = [organizationId], events = timeline) {
    const targetId = kind === 'organization' ? organizationId : userId
    const state = buildSubjectState(kind, organizationIds)
    const authorization = buildSupportSubjectInspectionAuthorization({
        kind,
        actorId: 'support-admin',
        requestedId: targetId,
        targetId,
        organizationIds,
        requestId,
    })
    const receipts = buildSupportSubjectInspectionReceipts({
        kind,
        actorId: 'support-admin',
        targetId,
        organizationIds,
        requestId,
        reason: 'Customer requested access review',
        supportContext: 'Case 123',
        timelineFilter: state.timelineFilter,
        timeline: events,
        supportActivityRollup: { schemaVersion: 'support.activity_rollup.v1', blockerCodes: [] },
        accessStatus: state.accessStatus,
        accessRecoveryPlan: state.accessRecoveryPlan,
    })
    return { state, authorization, receipts }
}

function expectActionHistoryArraysToMatch(receipts: ReturnType<typeof buildSupportSubjectInspectionReceipts>) {
    for (const key of ['auditEventIds', 'actions', 'outcomes', 'requestIds', 'entityIds'] as const) {
        expect(receipts.actionHistoryExport[key]).toEqual(receipts.actionHistoryReceipt[key])
    }
}

test('shared subject access state preserves organization and user target filters', () => {
    const organization = buildSubjectState('organization')
    expect(organization.timelineFilter).toMatchObject({ org: organizationId, user: '', entity: organizationId, entityType: 'organization', action: 'support.organization' })
    expect(organization.recoveryEligibility[0]).toMatchObject({
        organizationId,
        targetUserId: null,
        adminAvailability: { hasAvailableAdmin: true },
    })
    expect(organization.accessStatus).toMatchObject({
        overall: 'active_access',
        target: { organizationIds: [organizationId], userId: null },
        counts: { activeMemberships: 1, relatedAuditEvents: 1 },
    })

    const user = buildSubjectState('user')
    expect(user.timelineFilter).toMatchObject({ org: '', user: userId, entity: userId, entityType: 'user', action: 'support.user' })
    expect(user.recoveryEligibility[0]).toMatchObject({ organizationId, targetUserId: userId })
    expect(user.accessStatus).toMatchObject({
        overall: 'active_access',
        target: { organizationIds: [organizationId], userId },
        counts: { activeMemberships: 1, relatedAuditEvents: 1 },
    })
})

test('shared subject receipts preserve response schemas and action-specific routes', () => {
    const organization = buildReceipts('organization')
    expect(organization.authorization).toMatchObject({
        requested: { organizationId, userId: null },
        effective: { organizationId, userId: null },
    })
    expect(organization.receipts.inspectionReceipt).toMatchObject({
        schemaVersion: 'support.organization.inspection_receipt.v1',
        nextRoutes: { self: `/api/admin/support/organizations/${organizationId}`, audit: `/api/admin/audit-events?org=${organizationId}` },
    })
    expect(organization.receipts.actionHistoryReceipt.schemaVersion).toBe('support.organization.action_history_receipt.v1')
    expect(organization.receipts.actionHistoryExport.nextRoutes.impersonation).toBe(`/api/impersonation/events?org=${organizationId}`)
    expectActionHistoryArraysToMatch(organization.receipts)

    const user = buildReceipts('user')
    expect(user.authorization).toMatchObject({
        requested: { organizationId: null, userId },
        effective: { organizationId, userId },
    })
    expect(user.receipts.inspectionReceipt).toMatchObject({
        schemaVersion: 'support.user.inspection_receipt.v1',
        nextRoutes: { self: `/api/admin/support/users/${userId}`, impersonation: '/api/impersonation/start' },
    })
    expect(user.receipts.actionHistoryReceipt.schemaVersion).toBe('support.user.action_history_receipt.v1')
    expect(user.receipts.actionHistoryExport.nextRoutes.impersonation).toBe(`/api/impersonation/events?target=${userId}`)
    expectActionHistoryArraysToMatch(user.receipts)

    const unscopedUser = buildReceipts('user', [])
    expect(unscopedUser.receipts.inspectionReceipt.nextRoutes.accessRecovery).toBeNull()
    expect(unscopedUser.receipts.actionHistoryReceipt.nextRoutes.accessRecovery).toBeNull()
    expect(unscopedUser.receipts.actionHistoryExport.nextRoutes.accessRecovery).toBeNull()
})

test('action history receipts keep event order and deduplicate filter values from a multi-event timeline', () => {
    const result = buildReceipts('organization', [organizationId], [
        ...timeline,
        { id: 8, action: 'support.inspect', outcome: 'success', severity: 'info', requestId: 'request-2', entity: { id: 'user-2' } },
    ])
    const history = result.receipts.actionHistoryReceipt

    expect(history.auditEventIds).toEqual([7, 8])
    expect(history.actions).toEqual(['support.inspect'])
    expect(history.outcomes).toEqual(['success'])
    expect(history.requestIds).toEqual([requestId, 'request-2'])
    expect(history.entityIds).toEqual([organizationId, 'user-2'])
    expectActionHistoryArraysToMatch(result.receipts)
})

test('inspection context assembles access state, authorization, and receipts for both targets', () => {
    for (const kind of ['organization', 'user'] as const) {
        const targetId = kind === 'organization' ? organizationId : userId
        const member = {
            id: userId,
            user_id: userId,
            organization_id: organizationId,
            active: true,
            status: 'active',
            role: 'owner',
        }
        const context = buildSupportSubjectInspectionContext({
            kind,
            actorId: 'support-admin',
            requestedId: targetId,
            targetId,
            organizationIds: [organizationId],
            requestId,
            reason: 'Customer requested access review',
            supportContext: 'Case 123',
            users: kind === 'organization' ? [member] : [{ id: userId, active: true }],
            memberships: [member],
            invites: [],
            approvalDetails: [],
            availability: [availabilityByOrg.get(organizationId)!],
            timeline,
            supportActivityRollup: { schemaVersion: 'support.activity_rollup.v1', blockerCodes: [] },
        })

        expect(context.subjectAccessState.timelineFilter).toMatchObject({
            entity: targetId,
            entityType: kind,
            action: `support.${kind}`,
        })
        expect(context.authorization.effective).toMatchObject({
            organizationId,
            userId: kind === 'organization' ? null : userId,
        })
        expect(context.receipts.inspectionReceipt.schemaVersion).toBe(`support.${kind}.inspection_receipt.v1`)
        expect(context.receipts.inspectionReceipt.accessStatus).toMatchObject({
            overall: context.subjectAccessState.accessStatus.overall,
            blockers: context.subjectAccessState.accessStatus.blockers,
        })
    }
})
