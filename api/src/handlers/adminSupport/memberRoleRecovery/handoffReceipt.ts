import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'
import type { supportMemberRoleRecoveryExecutorControls } from './controls.ts'
import { supportMemberRoleRecoveryAuditQuery } from './auditQuery.ts'

export function supportMemberRecoveryHandoffReceipt(input: {
    actorId: string
    organizationId: string
    userId: string
    requestId: string
    reason: string
    requestedRole: string
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
    auditEventIds: number[]
}) {
    const currentRole = text(input.before?.role)
    const nextRole = text(input.after?.role) || currentRole || null
    const auditQuery = supportMemberRoleRecoveryAuditQuery({
        requestId: input.requestId,
        organizationId: input.organizationId,
        userId: input.userId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        reason: input.reason,
        outcome: input.outcome,
    })
    return {
        schemaVersion: 'support.member_recovery.handoff_receipt.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        noSilentMembershipMutation: true,
        mutationMode: input.outcome === 'success' ? 'controlled_member_role_only' : 'none',
        action: 'member_role_recovery',
        actionType: 'support.organization.member_role_recovery',
        actorId: input.actorId,
        actorRequired: true,
        target: {
            organizationId: input.organizationId,
            userId: input.userId,
            entityType: 'member',
            entityId: input.userId,
            currentRole: currentRole || null,
            requestedRole: input.requestedRole,
            resultingRole: nextRole,
        },
        requestId: input.requestId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        reason: input.reason,
        outcome: input.outcome,
        auditEventIds: input.auditEventIds,
        expectedAuditEventLookup: auditQuery,
        replayFilters: {
            current: auditQuery,
            byRequest: auditFilterQuery({ request: input.requestId, action: 'support.organization.member_role_recovery', outcome: input.outcome }),
            byEntity: auditFilterQuery({ org: input.organizationId, entity: input.userId, entityType: 'member', action: 'support.organization.member_role_recovery' }),
            byTarget: auditFilterQuery({ org: input.organizationId, target: input.userId, targetType: 'member', action: 'support.organization.member_role_recovery' }),
            byOutcome: auditFilterQuery({ org: input.organizationId, outcome: input.outcome, action: 'support.organization.member_role_recovery' }),
            bySupportSession: input.controls.supportSessionId ? auditFilterQuery({ supportSession: input.controls.supportSessionId, action: 'support.organization.member_role_recovery' }) : null,
            denied: auditFilterQuery({ org: input.organizationId, target: input.userId, action: 'support.organization.member_role_recovery', outcome: 'denied' }),
            staleOrDuplicate: auditFilterQuery({ org: input.organizationId, target: input.userId, action: 'support.organization.member_role_recovery', outcome: input.outcome, request: input.requestId }),
        },
        orgMemberRecoveryReadiness: {
            schemaVersion: 'support.member_recovery.readiness.v1',
            consumedExecutorSchema: 'support.action_execute.member_role_recovery.v1',
            requiredScope: 'member:role_recovery',
            requiredSessionState: 'active',
            controlledMutation: 'organization_members.role',
            blockedWhenAdminAvailable: true,
            blockedForOwnerGrant: true,
            blockedForLastOwnerDemotion: true,
            noCrossOrgRecovery: true,
            noSilentMembershipMutation: true,
            requiredAuditFields: ['actorId', 'targetId', 'organizationId', 'entityId', 'requestId', 'reason', 'outcome', 'severity', 'supportSessionId', 'idempotencyKey'],
        },
        receiptSchemas: [
            'support.member_recovery.handoff_receipt.v1',
            'support.action_execute.member_role_recovery.v1',
            'support.action_execute.audit_preview.v1',
            'support.organization.member.action_history_receipt.v1',
            'support.audit.timeline_replay_contract.v1',
        ],
        nextRoutes: {
            execute: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/members/${encodeURIComponent(input.userId)}/role-recovery`,
            memberInspection: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/members/${encodeURIComponent(input.userId)}`,
            organizationInspection: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}`,
            auditReplay: auditQuery,
            supportSession: input.controls.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.controls.supportSessionId)}` : null,
            auditDetails: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'invalid_scope',
            'stale_prepare_payload',
            'duplicate_idempotency_key',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'active_admin_available',
            'revoked_member',
            'member_role_already_set',
            'owner_grant_denied',
            'last_owner_demote_denied',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers: input.blockers,
        redaction: {
            applied: true,
            forbiddenFields: ['token', 'secret', 'authorization', 'cookie', 'webhookUrl', 'privateSourceUrl', 'sessionToken', 'inviteToken'],
        },
        copyText: [
            `Support member recovery handoff ${input.userId}`,
            `Org: ${input.organizationId}`,
            `Request: ${input.requestId}`,
            `Outcome: ${input.outcome}`,
            `Role: ${currentRole || 'unknown'} -> ${input.requestedRole}`,
            `Audit: ${input.auditEventIds.join(', ') || 'pending'}`,
            `Replay: ${auditQuery}`,
        ].join('\n'),
    }
}
