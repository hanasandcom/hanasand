import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import type { supportCaseTimelineEvidence } from '../audit/auditCaseTimeline.ts'
import type { SupportUserCaseEvidence } from './userAccessReadiness.ts'

export function supportUserCaseHandoff(input: {
    actorId: string
    userId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    caseAccessReadiness: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    actionHistoryExport: Record<string, any>
    evidence: SupportUserCaseEvidence
    timelineEvidence: ReturnType<typeof supportCaseTimelineEvidence>
}) {
    const timelineSummary = input.timelineEvidence
    const { auditEventIds } = timelineSummary
    const recoveryBlockers = uniqueTimelineValues([
        ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        input.organizationIds.length ? '' : 'missing_organization_scope',
        input.evidence.activeMembershipCount || input.evidence.allInviteCount || input.evidence.approvalRequestCount ? '' : 'missing_access_evidence',
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
            membershipCount: input.evidence.membershipCount,
            activeMembershipCount: input.evidence.activeMembershipCount,
            pendingInviteCount: input.evidence.allInviteCount,
            approvalRequestCount: input.evidence.approvalRequestCount,
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
            invites: input.evidence.pendingInvites.map(invite => auditFilterQuery({ org: invite.organizationId, entity: invite.id, entityType: 'invite', source: 'admin', service: 'hanasand-api' })),
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
            `Evidence: memberships=${input.evidence.membershipCount} invites=${input.evidence.allInviteCount} approvals=${input.evidence.approvalRequestCount}`,
            `Audit events: ${auditEventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery({ target: input.userId, request: input.requestId, source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}
