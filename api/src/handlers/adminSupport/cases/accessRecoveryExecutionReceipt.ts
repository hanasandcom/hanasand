import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'

export function supportAccessRecoveryExecutionReceipt(input: {
    actorId: string
    organizationId: string
    requestId: string
    reason: string
    supportSessionId: string
    targetUserId: string
    email: string
    role: string
    expiresAt: string
    inviteId: string | null
    inviteStatus: string | null
    approval: Record<string, any> | null
    outcome: 'success' | 'denied' | 'failed'
    auditEventIds: number[]
    blockers: string[]
}) {
    const actionType = 'support.organization.access_recovery'
    const entityId = input.inviteId || input.targetUserId || input.email
    const targetId = input.targetUserId || input.email
    return {
        schemaVersion: 'support.access_recovery.execution_receipt.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        expiryRequired: true,
        noSilentMembershipMutation: true,
        mutationMode: input.outcome === 'success' ? 'controlled_invite_only' : 'none',
        action: 'access_recovery',
        actionType,
        outcome: input.outcome,
        severity: 'warning',
        actorId: input.actorId,
        organizationId: input.organizationId,
        targetType: input.targetUserId ? 'user' : 'invite',
        targetId,
        entityId,
        requestId: input.requestId,
        reason: input.reason,
        scope: ['recovery:invite'],
        expiresAt: input.expiresAt,
        supportSessionId: input.supportSessionId || null,
        inviteId: input.inviteId,
        inviteStatus: input.inviteStatus,
        email: input.email,
        role: input.role,
        approvalRequired: Boolean(input.approval?.approvalRequired),
        approvalStatus: input.approval?.status || null,
        auditEventIds: input.auditEventIds,
        audit: {
            detailRoutes: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            replay: auditFilterQuery({ org: input.organizationId, action: actionType, request: input.requestId, entity: entityId, outcome: input.outcome }),
            byRequest: auditFilterQuery({ request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            byEntity: auditFilterQuery({ entity: entityId, entityType: input.inviteId ? 'invite' : '', request: input.requestId }),
            byTarget: auditFilterQuery({ target: targetId, action: actionType, request: input.requestId }),
            bySupportSession: input.supportSessionId ? auditFilterQuery({ supportSession: input.supportSessionId, action: actionType }) : null,
            deniedReplay: auditFilterQuery({ org: input.organizationId, action: actionType, outcome: 'denied', request: input.requestId }),
        },
        nextRoutes: {
            inspect: `/api/admin/support/access-recovery/${encodeURIComponent(input.requestId)}`,
            approve: `/api/admin/support/access-recovery/${encodeURIComponent(input.requestId)}/approve`,
            deny: `/api/admin/support/access-recovery/${encodeURIComponent(input.requestId)}/deny`,
            organization: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}`,
            invite: input.inviteId ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites/${encodeURIComponent(input.inviteId)}` : null,
            audit: auditFilterQuery({ request: input.requestId, action: actionType, source: 'admin', service: 'hanasand-api' }),
        },
        denialCases: [
            { code: 'missing_support_reason', field: 'reason', auditOutcome: 'denied' },
            { code: 'support_session_not_found', field: 'supportSessionId', auditOutcome: 'denied' },
            { code: 'support_session_revoked', field: 'supportSessionId', auditOutcome: 'denied' },
            { code: 'support_session_expired', field: 'supportSessionId', auditOutcome: 'denied' },
            { code: 'support_session_scope_denied', field: 'scope', auditOutcome: 'denied' },
            { code: 'pending_approval_requires_decision', field: 'approvalStatus', auditOutcome: 'success' },
            { code: 'duplicate_invite', field: 'email', auditOutcome: 'failed' },
        ],
        blockers: input.blockers,
        copyText: [
            `Access recovery receipt ${input.requestId}`,
            `Org: ${input.organizationId}`,
            `Target: ${targetId}`,
            `Invite: ${input.inviteId || 'not created'}`,
            `Outcome: ${input.outcome}`,
            `Approval: ${input.approval?.status || 'none'}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Replay: ${auditFilterQuery({ request: input.requestId, action: actionType, source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}
