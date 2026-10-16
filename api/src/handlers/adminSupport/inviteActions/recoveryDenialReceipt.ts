import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import type { SupportInviteActionContext } from './types.ts'

export function supportInviteRecoveryDenialReceipt(input: Pick<SupportInviteActionContext, 'requestId' | 'action' | 'actionType' | 'reason' | 'controls'> & {
    organizationId: string
    actorId: string
    invite: SupportInviteActionContext['invite'] | null
    outcome: 'denied' | 'failed'
    auditEventIds: number[]
    blockers: string[]
}) {
    const inviteId = input.invite?.id || ''
    const targetEmail = input.invite?.email || null
    const primaryBlocker = input.blockers[0] || (input.outcome === 'denied' ? 'support_invite_action_denied' : 'support_invite_action_failed')
    const replayFilters = {
        byRequest: auditFilterQuery({ request: input.requestId, outcome: input.outcome }),
        byOrganization: auditFilterQuery({ org: input.organizationId, outcome: input.outcome }),
        byInvite: auditFilterQuery({ targetType: 'invite', entity: inviteId, outcome: input.outcome }),
        byAction: auditFilterQuery({ action: input.actionType, outcome: input.outcome }),
        bySupportSession: input.controls.supportSessionId
            ? auditFilterQuery({ supportSession: input.controls.supportSessionId, outcome: input.outcome })
            : null,
        byIdempotency: auditFilterQuery({ idempotency: input.controls.idempotencyKey, outcome: input.outcome }),
    }
    return {
        schemaVersion: 'support.invite_recovery.denial_receipt.v1',
        generatedAt: new Date().toISOString(),
        action: input.action,
        actionType: input.actionType,
        outcome: input.outcome,
        severity: input.action === 'revoke' ? 'warning' : 'notice',
        actorId: input.actorId,
        organizationId: input.organizationId,
        targetType: 'invite',
        targetId: targetEmail || inviteId || input.organizationId,
        entityId: inviteId || input.organizationId,
        inviteId: inviteId || null,
        targetEmail,
        requestId: input.requestId,
        reason: input.reason,
        scope: input.controls.scope,
        supportSessionId: input.controls.supportSessionId || null,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        staleBlocker: input.controls.staleBlocker,
        duplicateBlocker: input.controls.duplicateBlocker,
        blockerCode: primaryBlocker,
        blockers: input.blockers,
        blockerCatalog: [
            'support_role_required',
            'missing_support_reason',
            'missing_support_context',
            'invalid_scope',
            'stale_prepare_payload',
            'duplicate_idempotency_key',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'invite_unavailable',
            'accepted_invite_not_mutable_by_support_action',
            'audit_unavailable',
            'redaction_required',
        ],
        safety: {
            supportOnly: true,
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        replayFilters,
        auditEventIds: input.auditEventIds,
        auditDetailRoutes: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        caseReplay: {
            schemaVersion: 'support.invite_recovery.case_replay.v1',
            route: '/api/admin/support/receipt-replay',
            requestId: input.requestId,
            organizationId: input.organizationId,
            inviteId: inviteId || null,
            action: input.action,
            outcome: input.outcome,
            blockerCode: primaryBlocker,
            filters: replayFilters,
            nextRoutes: [
                `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}`,
                `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites/${encodeURIComponent(inviteId || ':inviteId')}/action`,
            ],
        },
        orgReadiness: {
            schemaVersion: 'support.invite_recovery.org_readiness.v1',
            organizationId: input.organizationId,
            inviteId: inviteId || null,
            recoveryBlocked: true,
            blockerCode: primaryBlocker,
            requiresOrgAdminUnavailable: true,
            requiresFreshSupportSession: true,
            requiresReason: true,
            auditReplayAvailable: input.auditEventIds.length > 0,
        },
        copyText: [
            `Support invite recovery ${input.outcome}`,
            `Request: ${input.requestId}`,
            `Blocker: ${primaryBlocker}`,
            `Replay: ${replayFilters.byRequest}`,
        ].join('\n'),
    }
}
