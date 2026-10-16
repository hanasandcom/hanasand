import { expect, test } from 'bun:test'
import {
    auditFilterQuery,
    supportInspectionActionAuditContract,
    supportInspectionAuditDetailPacket,
    supportInspectionAuditFilterCoverage,
    supportInspectionOrgBoundaryProof,
    supportInspectionSearchProof,
    type SupportTimelineFilter,
} from '../src/utils/support/inspectionPackets.ts'

const timelineFilter: SupportTimelineFilter = {
    q: '', org: 'org-1', user: 'user-1', email: '', request: '', entity: '', entityType: '',
    supportSession: '', workflow: '', action: '', severity: '', outcome: '', source: '',
    service: '', blocker: '', reason: '', scope: '', context: '', from: '', to: '',
    limit: 50, unsupported: [],
}

test('inspection search proof preserves counts, IDs, routes, and replay filter', () => {
    const packet = supportInspectionSearchProof({
        q: '', org: 'org-1', user: 'user-1', email: '', request: '', entity: '', supportSession: '',
        organizationIds: ['org-1'],
        organizations: [{ id: 'org-1' }],
        users: [{ id: 'user-1' }],
        memberships: [{ organization_id: 'org-1', user_id: 'user-1', status: 'active' }],
        invites: [{ id: 'invite-1', organization_id: 'org-1', status: 'pending' }],
        approvalDetails: [{ requestId: 'request-1' }],
        timeline: [{ id: 12, requestId: 'request-1', links: { detail: '/api/admin/audit-events/12' } }],
        timelineFilter,
    })

    expect(packet.schemaVersion).toBe('support.inspection.search_proof.v1')
    expect(packet.resultCounts).toMatchObject({ organizations: 1, users: 1, activeMemberships: 1, pendingInvites: 1, approvals: 1, auditEvents: 1 })
    expect(packet.matchedIds).toMatchObject({ organizationIds: ['org-1'], userIds: ['user-1'], inviteIds: ['invite-1'], requestIds: ['request-1'], auditEventIds: [12] })
    expect(packet.availableActions.inviteAssist).toEqual(['/api/admin/support/organizations/org-1/invites'])
    expect(packet.audit.query).toBe('/api/admin/audit-events?org=org-1&target=user-1')
})

test('org boundary proof flags cross-organization evidence and retains replay links', () => {
    const packet = supportInspectionOrgBoundaryProof({
        requestedOrg: 'org-1', requestedUser: 'user-1', email: '', request: '', supportSession: '',
        sessionState: null,
        authorization: { blockers: [] },
        organizationIds: ['org-1'],
        memberships: [{ organization_id: 'org-1' }],
        invites: [],
        timeline: [{ organizationId: 'org-2', id: 3 }],
        timelineFilter,
    })

    expect(packet.schemaVersion).toBe('support.inspection.org_boundary_proof.v1')
    expect(packet.matched).toMatchObject({ organizationIds: ['org-1', 'org-2'], crossOrgMatches: ['org-2'] })
    expect(packet.blockers).toContain('cross_org_match_requires_explicit_scope')
    expect(packet.audit.replay).toBe(auditFilterQuery(timelineFilter))
})

test('audit filter coverage preserves supported filters and denial replay', () => {
    const packet = supportInspectionAuditFilterCoverage({
        timelineFilter,
        timeline: [{ id: 4, action: 'support.inspect', outcome: 'denied', severity: 'warning', entityId: 'user-1', requestId: 'request-1', links: { detail: '/api/admin/audit-events/4' } }],
        organizationIds: ['org-1'], user: 'user-1', email: '', request: '', supportSession: '',
    })

    expect(packet.schemaVersion).toBe('support.inspection.audit_filter_coverage.v1')
    expect(packet.targetBounded).toBe(true)
    expect(packet.resultCoverage).toMatchObject({ eventCount: 1, eventIds: [4], actionValues: ['support.inspect'], outcomeValues: ['denied'] })
    expect(packet.replay.denied).toContain('outcome=denied')
    expect(packet.blockers).not.toContain('overbroad_support_inspection')
})

test('audit detail and coverage packets share unique request replay evidence', () => {
    const timeline = [
        {
            id: 12, requestId: 'request-1', reason: 'private reason', context: { token: 'secret' },
            links: { detail: '/api/admin/audit-events/12' },
        },
        {
            id: 13, requestId: 'request-2', reason: '', context: { email: 'private@example.com' },
            links: { detail: '/api/admin/audit-events/13' },
        },
    ]
    const detail = supportInspectionAuditDetailPacket({
        org: 'org-1', user: 'user-1', email: '', request: 'request-1', supportSession: '',
        organizationIds: ['org-1'], memberships: [], invites: [], timeline, timelineFilter,
    })
    const coverage = supportInspectionAuditFilterCoverage({
        timelineFilter, timeline, organizationIds: ['org-1'],
        user: 'user-1', email: '', request: 'request-1', supportSession: '',
    })

    expect(detail.replayFilters.request).toEqual([
        '/api/admin/audit-events?request=request-1',
        '/api/admin/audit-events?request=request-2',
    ])
    expect(coverage.replay.byRequest).toEqual(detail.replayFilters.request)
    expect(detail.detailRoutes).toEqual(['/api/admin/audit-events/12', '/api/admin/audit-events/13'])
    expect(detail.detailEvents[0]).toMatchObject({ id: 12, reasonPresent: true })
    expect(detail.detailEvents[0]).not.toHaveProperty('reason')
    expect(detail.detailEvents[0]).not.toHaveProperty('context')
    expect(detail.redacted).toBe(true)
    expect(detail.noMutation).toBe(true)
})

test('action audit contract reuses fixture target classification and severity in its preview', () => {
    const packet = supportInspectionActionAuditContract({
        recoveryFixturePacket: {
            fixtures: [
                { expectedAuditAction: 'impersonation.start', available: true },
                { expectedAuditAction: 'support.invite.revoke', available: false },
                { expectedAuditAction: 'organization.member.remove', available: true },
                { expectedAuditAction: 'support.access_recovery.complete', available: true },
                { expectedAuditAction: 'support.organization.inspect', available: true },
            ],
        },
        timelineFilter,
        organizationIds: ['org-1'], user: 'user-1', email: '', request: 'request-1', supportSession: '',
    })

    expect(packet.actionContracts.map(({ actionType, targetType, severity, creationPreview }) => ({
        actionType,
        targetType,
        severity,
        previewTargetType: creationPreview.targetType,
        previewSeverity: creationPreview.severity,
    }))).toEqual([
        { actionType: 'impersonation.start', targetType: 'user', severity: 'warning', previewTargetType: 'user', previewSeverity: 'warning' },
        { actionType: 'support.invite.revoke', targetType: 'invite', severity: 'notice', previewTargetType: 'invite', previewSeverity: 'notice' },
        { actionType: 'organization.member.remove', targetType: 'member', severity: 'notice', previewTargetType: 'member', previewSeverity: 'notice' },
        { actionType: 'support.access_recovery.complete', targetType: 'organization', severity: 'warning', previewTargetType: 'organization', previewSeverity: 'warning' },
        { actionType: 'support.organization.inspect', targetType: 'organization', severity: 'notice', previewTargetType: 'organization', previewSeverity: 'notice' },
    ])
})
