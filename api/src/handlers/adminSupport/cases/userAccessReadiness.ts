import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAccessRecoveryState } from './accessRecoveryState.ts'

export function supportUserCaseAccessReadiness(input: {
    userId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    memberships: Array<Record<string, any>>
    pendingInvites: Array<Record<string, any>>
    approvalRequests: Array<Record<string, any>>
    accessStatus: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    timeline: Array<Record<string, any>>
}) {
    const auditEventIds = input.timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id))
    const activeMemberships = input.memberships.filter(membership => membership.status === 'active')
    const removedMemberships = input.memberships.filter(membership => membership.status === 'removed' || membership.removed === true)
    const pendingInvites = input.pendingInvites.filter(invite => invite.status === 'pending')
    const { accessBlockers, recoveryBlockers, recoveryState } = supportAccessRecoveryState(input.accessStatus, input.accessRecoveryPlan)
    const blockers = uniqueTimelineValues([
        input.organizationIds.length ? '' : 'missing_organization_scope',
        activeMemberships.length || pendingInvites.length || input.approvalRequests.length ? '' : 'missing_access_evidence',
        auditEventIds.length ? '' : 'missing_case_audit_events',
        ...accessBlockers,
        ...recoveryBlockers,
    ])
    return {
        schemaVersion: 'support.user_case_access_readiness.v1',
        generatedAt: new Date().toISOString(),
        userId: input.userId,
        organizationIds: input.organizationIds,
        requestId: input.requestId,
        reason: input.reason || null,
        supportContextPresent: Boolean(input.supportContext),
        status: blockers.length ? 'needs_review' : 'ready',
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        evidence: {
            activeMembershipCount: activeMemberships.length,
            removedMembershipCount: removedMemberships.length,
            pendingInviteCount: pendingInvites.length,
            approvalRequestCount: input.approvalRequests.length,
            auditEventIds,
        },
        recoveryState,
        replayFilters: {
            current: auditFilterQuery({ target: input.userId, request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            memberships: input.organizationIds.map(org => auditFilterQuery({ org, target: input.userId, entityType: 'member', source: 'admin', service: 'hanasand-api' })),
            invites: pendingInvites.map(invite => auditFilterQuery({ org: invite.organizationId, entity: invite.id, entityType: 'invite', source: 'admin', service: 'hanasand-api' })),
            recovery: auditFilterQuery({ target: input.userId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            impersonation: auditFilterQuery({ target: input.userId, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ target: input.userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        },
        nextRoutes: {
            userInspection: `/api/admin/support/users/${encodeURIComponent(input.userId)}`,
            organizationInspections: input.organizationIds.map(org => `/api/admin/support/organizations/${encodeURIComponent(org)}`),
            accessRecovery: input.organizationIds[0] ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationIds[0])}/access-recovery` : null,
            impersonation: '/api/impersonation/start',
            impersonationEvents: `/api/impersonation/events?target=${encodeURIComponent(input.userId)}`,
            auditReplay: auditFilterQuery({ target: input.userId, request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            caseReplay: '/api/admin/support/receipt-replay',
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noSilentImpersonation: true,
            noCrossOrgLeakage: true,
            noSecretExposure: true,
            redactionRequired: true,
        },
        forbiddenFields: ['token', 'secret', 'authorization', 'cookie', 'sessionToken', 'inviteToken', 'privateSourceUrl'],
        denialStates: [
            'support_role_required',
            'missing_support_reason',
            'missing_organization_scope',
            'missing_access_evidence',
            'support_session_expired',
            'support_session_revoked',
            'support_session_scope_denied',
            'impersonation_ineligible',
            'denied_recovery_approval',
            'redaction_required',
        ],
        blockers,
        copyText: [
            `Support user case access readiness user=${input.userId}`,
            `Organizations: ${input.organizationIds.length}`,
            `Evidence: memberships=${activeMemberships.length} invites=${pendingInvites.length} approvals=${input.approvalRequests.length}`,
            `Replay: ${auditFilterQuery({ target: input.userId, request: input.requestId, source: 'admin', service: 'hanasand-api' })}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
