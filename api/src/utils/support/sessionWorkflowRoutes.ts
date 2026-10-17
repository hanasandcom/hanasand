import type { SupportSessionState } from './sessionTypes.ts'

type WorkflowRouteInput = Pick<
    SupportSessionState,
    'supportSessionId' | 'organizationId' | 'targetUserId' | 'allowedActions' | 'scope'
>

export function supportSessionWorkflowRoutes(input: WorkflowRouteInput) {
    const organizationId = input.organizationId ? encodeURIComponent(input.organizationId) : ':organizationId'
    const targetUserId = input.targetUserId ? encodeURIComponent(input.targetUserId) : ':userId'
    const actions = new Set(input.allowedActions || [])
    const scope = new Set(input.scope || [])
    return {
        detail: `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}`,
        revoke: `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}/revoke`,
        audit: `/api/admin/audit-events?supportSession=${encodeURIComponent(input.supportSessionId)}&source=system&service=hanasand-api`,
        inviteAssistance: actions.has('invite_assist') && scope.has('invite:create')
            ? `/api/admin/support/organizations/${organizationId}/invites`
            : null,
        inviteResend: actions.has('invite_resend') && scope.has('invite:resend')
            ? `/api/admin/support/organizations/${organizationId}/invites/:inviteId/actions`
            : null,
        inviteRevoke: actions.has('invite_revoke') && scope.has('invite:revoke')
            ? `/api/admin/support/organizations/${organizationId}/invites/:inviteId/actions`
            : null,
        accessRecovery: actions.has('access_recovery') && scope.has('recovery:invite')
            ? `/api/admin/support/organizations/${organizationId}/access-recovery`
            : null,
        accessRecoveryApproval: actions.has('access_recovery') && (scope.has('recovery:approve') || scope.has('recovery:deny'))
            ? '/api/admin/support/access-recovery/:requestId/:decision'
            : null,
        memberRoleRecovery: actions.has('member_role_recovery') && scope.has('member:role_recovery')
            ? `/api/admin/support/organizations/${organizationId}/members/${targetUserId}/role-recovery`
            : null,
        impersonation: actions.has('impersonation')
            ? '/api/impersonation/start'
            : null,
    }
}
