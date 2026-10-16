import { supportExecutorAuditPreview, supportExecutorCommonBlockerCatalog } from '../executorAudit.ts'
import { supportExecutorMetadata } from '../executorCore.ts'
import type { SupportInviteAction, SupportInviteActionContext } from './types.ts'

export function supportInviteActionExecutorDetail(input: Pick<SupportInviteActionContext, 'requestId' | 'actionType' | 'reason' | 'controls'> & {
    organizationId: string
    action: SupportInviteAction
    invite: SupportInviteActionContext['invite'] | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
}) {
    return {
        schemaVersion: 'support.action_execute.invite_action.v1',
        mutationMode: 'controlled_invite_row_only',
        action: input.action,
        actionType: input.actionType,
        ...supportExecutorMetadata(input.requestId, input.controls, input.action === 'resend'),
        target: {
            organizationId: input.organizationId,
            inviteId: input.invite?.id || null,
            email: input.invite?.email || null,
        },
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        before: input.before,
        after: input.after,
        outcome: input.outcome,
        blockers: input.blockers,
        blockerCatalog: [
            ...supportExecutorCommonBlockerCatalog,
            'ambiguous_target',
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
            'mutation_unavailable',
            'audit_unavailable',
            'redaction_required',
            'unsafe_impersonation',
        ],
        redactedAuditPreview: supportExecutorAuditPreview({
            ...input,
            organizationId: input.organizationId,
            targetFields: { inviteId: input.invite?.id || null, email: input.invite?.email || null },
        }),
    }
}
