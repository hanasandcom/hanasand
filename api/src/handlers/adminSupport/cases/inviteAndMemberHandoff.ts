import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { supportCaseTimelineEvidence } from '../audit/auditCaseTimeline.ts'

export function supportInviteCaseHandoff(input: {
    actorId: string
    organizationId: string
    invite: Record<string, any>
    requestId: string
    reason: string
    supportContext: string
    accessRecoveryPlan: Record<string, any>
    approvals: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
}) {
    const inviteId = text(input.invite.id)
    const targetEmail = text(input.invite.email)
    const timelineSummary = supportCaseTimelineEvidence(input.timeline)
    const { auditEventIds } = timelineSummary
    const recoveryBlockers = uniqueTimelineValues([
        ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        input.invite.status === 'accepted' ? 'accepted_invite_not_mutable_by_support_action' : '',
    ])
    return {
        schemaVersion: 'support.invite.case_handoff.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        actorId: input.actorId,
        organizationId: input.organizationId,
        inviteId,
        targetEmail,
        requestId: input.requestId,
        reason: input.reason || null,
        supportContextPresent: Boolean(input.supportContext),
        evidence: {
            inviteStatus: input.invite.status || null,
            inviteRole: input.invite.role || null,
            approvalRequestCount: input.approvals.length,
            ...timelineSummary,
        },
        recovery: {
            accessRecoveryAvailable: Boolean(input.accessRecoveryPlan.available || input.accessRecoveryPlan.items?.length),
            blockers: recoveryBlockers,
            approvalStatuses: uniqueTimelineValues(input.approvals.map(approval => approval.status)),
        },
        inviteActions: {
            resend: {
                route: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
                requiredScope: 'invite:resend',
                reasonRequired: true,
                idempotencyRequired: true,
            },
            revoke: {
                route: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
                requiredScope: 'invite:revoke',
                reasonRequired: true,
                idempotencyRequired: true,
            },
        },
        replayFilters: {
            current: auditFilterQuery({ org: input.organizationId, entity: inviteId, entityType: 'invite', request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            inviteActions: auditFilterQuery({ org: input.organizationId, entity: inviteId, action: 'support.organization.invite', source: 'admin', service: 'hanasand-api' }),
            recovery: auditFilterQuery({ org: input.organizationId, target: targetEmail, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: input.organizationId, entity: inviteId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        },
        nextRoutes: {
            supportInspection: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites/${encodeURIComponent(inviteId)}`,
            inviteAction: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
            accessRecovery: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/access-recovery`,
            auditTimeline: `/api/admin/audit-events?org=${encodeURIComponent(input.organizationId)}&entity=${encodeURIComponent(inviteId)}`,
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'wrong_org_scope',
            'accepted_invite_not_mutable_by_support_action',
            'support_session_expired',
            'support_session_revoked',
            'duplicate_idempotency_key',
            'denied_recovery_approval',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            auditEventIds.length ? '' : 'missing_case_audit_events',
            inviteId ? '' : 'missing_invite_id',
            ...recoveryBlockers,
        ]),
    }
}

export function supportMemberCaseHandoff(input: {
    actorId: string
    organizationId: string
    member: Record<string, any>
    requestId: string
    reason: string
    supportContext: string
    accessRecoveryPlan: Record<string, any>
    approvals: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
}) {
    const userId = text(input.member.userId)
    const timelineSummary = supportCaseTimelineEvidence(input.timeline)
    const { auditEventIds } = timelineSummary
    const recoveryBlockers = uniqueTimelineValues([
        ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        input.member.status === 'removed' ? 'removed_member_requires_reactivation_review' : '',
        input.member.active === false ? 'deactivated_member_requires_access_review' : '',
    ])
    return {
        schemaVersion: 'support.member.case_handoff.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        actorId: input.actorId,
        organizationId: input.organizationId,
        userId,
        requestId: input.requestId,
        reason: input.reason || null,
        supportContextPresent: Boolean(input.supportContext),
        evidence: {
            role: input.member.role || null,
            status: input.member.status || null,
            active: input.member.active ?? null,
            approvalRequestCount: input.approvals.length,
            ...timelineSummary,
        },
        recovery: {
            accessRecoveryAvailable: Boolean(input.accessRecoveryPlan.available || input.accessRecoveryPlan.items?.length),
            roleRecoveryAvailable: Boolean(userId && input.member.status !== 'removed'),
            blockers: recoveryBlockers,
            approvalStatuses: uniqueTimelineValues(input.approvals.map(approval => approval.status)),
        },
        memberActions: {
            roleRecovery: {
                route: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/members/${encodeURIComponent(userId)}/role-recovery`,
                requiredScope: 'member:role_recovery',
                reasonRequired: true,
                idempotencyRequired: true,
            },
            inspectUser: `/api/admin/support/users/${encodeURIComponent(userId)}`,
        },
        replayFilters: {
            current: auditFilterQuery({ org: input.organizationId, target: userId, entity: userId, entityType: 'member', request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            roleRecovery: auditFilterQuery({ org: input.organizationId, target: userId, action: 'member_role_recovery', source: 'admin', service: 'hanasand-api' }),
            recovery: auditFilterQuery({ org: input.organizationId, target: userId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: input.organizationId, target: userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        },
        nextRoutes: {
            supportInspection: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/members/${encodeURIComponent(userId)}`,
            roleRecovery: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/members/${encodeURIComponent(userId)}/role-recovery`,
            auditTimeline: `/api/admin/audit-events?org=${encodeURIComponent(input.organizationId)}&target=${encodeURIComponent(userId)}`,
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'wrong_org_scope',
            'removed_member_requires_reactivation_review',
            'deactivated_member_requires_access_review',
            'support_session_expired',
            'support_session_revoked',
            'denied_recovery_approval',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            auditEventIds.length ? '' : 'missing_case_audit_events',
            userId ? '' : 'missing_member_user_id',
            ...recoveryBlockers,
        ]),
    }
}
