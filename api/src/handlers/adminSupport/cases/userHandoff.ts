import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportCaseTimelineEvidence } from '../audit/auditCaseTimeline.ts'

export function supportUserCaseHandoff(input: {
    actorId: string
    userId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    memberships: Array<Record<string, any>>
    pendingInvites: Array<Record<string, any>>
    approvalRequests: Array<Record<string, any>>
    caseAccessReadiness: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    actionHistoryExport: Record<string, any>
    timeline: Array<Record<string, any>>
}) {
    const timelineSummary = supportCaseTimelineEvidence(input.timeline)
    const { auditEventIds } = timelineSummary
    const activeMemberships = input.memberships.filter(membership => membership.status === 'active')
    const recoveryBlockers = uniqueTimelineValues([
        ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        input.organizationIds.length ? '' : 'missing_organization_scope',
        activeMemberships.length || input.pendingInvites.length || input.approvalRequests.length ? '' : 'missing_access_evidence',
    ])
    return {
        schemaVersion: 'support.user.case_handoff.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        actorId: input.actorId,
        userId: input.userId,
        organizationIds: input.organizationIds,
        requestId: input.requestId,
        reason: input.reason || null,
        supportContextPresent: Boolean(input.supportContext),
        evidence: {
            membershipCount: input.memberships.length,
            activeMembershipCount: activeMemberships.length,
            pendingInviteCount: input.pendingInvites.length,
            approvalRequestCount: input.approvalRequests.length,
            ...timelineSummary,
            caseAccessReadiness: input.caseAccessReadiness,
        },
        recovery: {
            accessRecoveryAvailable: Boolean(input.accessRecoveryPlan.available || input.accessRecoveryPlan.items?.length),
            blockers: recoveryBlockers,
            actionHistorySchema: input.actionHistoryExport.schemaVersion || null,
            readinessMatrixSchema: input.actionHistoryExport.recoveryReadinessMatrix?.schemaVersion || null,
        },
        impersonation: {
            route: '/api/impersonation/start',
            eventsRoute: `/api/impersonation/events?target=${encodeURIComponent(input.userId)}`,
            reasonRequired: true,
            scopeRequired: true,
            durationRequired: true,
            supportSessionRequired: true,
            expectedAuditAction: 'impersonation.start',
            replay: auditFilterQuery({ target: input.userId, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
        },
        replayFilters: {
            current: auditFilterQuery({ target: input.userId, request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            memberships: input.organizationIds.map(org => auditFilterQuery({ org, target: input.userId, entityType: 'member', source: 'admin', service: 'hanasand-api' })),
            invites: input.pendingInvites.map(invite => auditFilterQuery({ org: invite.organizationId, entity: invite.id, entityType: 'invite', source: 'admin', service: 'hanasand-api' })),
            recovery: auditFilterQuery({ target: input.userId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            impersonation: auditFilterQuery({ target: input.userId, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ target: input.userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        },
        nextRoutes: {
            supportInspection: `/api/admin/support/users/${encodeURIComponent(input.userId)}`,
            auditTimeline: `/api/admin/audit-events?target=${encodeURIComponent(input.userId)}`,
            impersonation: '/api/impersonation/start',
            accessRecovery: input.organizationIds[0] ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationIds[0])}/access-recovery` : null,
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noSilentImpersonation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'missing_organization_scope',
            'missing_access_evidence',
            'support_session_expired',
            'support_session_revoked',
            'impersonation_ineligible',
            'denied_recovery_approval',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            auditEventIds.length ? '' : 'missing_case_audit_events',
            ...recoveryBlockers,
        ]),
        copyText: [
            `Support user case handoff user=${input.userId}`,
            `Request: ${input.requestId}`,
            `Evidence: memberships=${input.memberships.length} invites=${input.pendingInvites.length} approvals=${input.approvalRequests.length}`,
            `Audit events: ${auditEventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery({ target: input.userId, request: input.requestId, source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}
