import { supportExecutorAuditPreview, supportExecutorCommonBlockerCatalog } from '../executorAudit.ts'
import { supportExecutorMetadata } from '../executorCore.ts'
import { supportMemberRecoveryHandoffReceipt } from './handoffReceipt.ts'
import type { supportMemberRoleRecoveryExecutorControls } from './controls.ts'

export function supportMemberRoleRecoveryExecutorDetail(input: {
    actorId: string
    organizationId: string
    userId: string
    requestId: string
    reason: string
    requestedRole: string
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
    member: Record<string, unknown> | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
    auditEventIds?: number[]
}) {
    const auditEventIds = Array.isArray(input.auditEventIds) ? input.auditEventIds.filter(id => Number.isFinite(id)) : []
    return {
        schemaVersion: 'support.action_execute.member_role_recovery.v1',
        mutationMode: 'controlled_member_role_only',
        action: 'member_role_recovery',
        actionType: 'support.organization.member_role_recovery',
        ...supportExecutorMetadata(input.requestId, input.controls),
        target: {
            organizationId: input.organizationId,
            userId: input.userId,
            currentRole: input.before?.role || input.member?.role || null,
            requestedRole: input.requestedRole,
        },
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        before: input.before,
        after: input.after,
        outcome: input.outcome,
        blockers: input.blockers,
        auditEventIds,
        memberRecoveryHandoff: supportMemberRecoveryHandoffReceipt({
            actorId: input.actorId,
            organizationId: input.organizationId,
            userId: input.userId,
            requestId: input.requestId,
            reason: input.reason,
            requestedRole: input.requestedRole,
            controls: input.controls,
            before: input.before,
            after: input.after,
            outcome: input.outcome,
            blockers: input.blockers,
            auditEventIds,
        }),
        blockerCatalog: [
            ...supportExecutorCommonBlockerCatalog,
            'invalid_scope',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'revoked_member',
            'member_role_already_set',
            'last_owner_demote_denied',
            'owner_grant_denied',
            'audit_unavailable',
            'redaction_required',
        ],
        redactedAuditPreview: supportExecutorAuditPreview({
            ...input,
            actionType: 'support.organization.member_role_recovery',
            targetFields: { targetUserId: input.userId, requestedRole: input.requestedRole },
        }),
    }
}
