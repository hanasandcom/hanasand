import { auditFilterQuery, uniqueTimelineValues } from './inspectionPackets.ts'
import { supportText as text } from './adminSupportInput.ts'
import { supportSessionWorkflowRoutes } from './sessionWorkflowRoutes.ts'
import type { SupportSessionState } from './sessionTypes.ts'

export function supportSessionLifecycleReceipt(input: SupportSessionState) {
    const status = text(input.status) || 'unknown'
    const actionType = status === 'revoked' ? 'support.session.revoke' : 'support.session.create'
    const scope = input.scope || []
    const allowedActions = input.allowedActions || []
    const workflowRoutes = supportSessionWorkflowRoutes(input)
    const blockers = uniqueTimelineValues([
        input.reason ? '' : 'missing_support_reason',
        input.expiresAt ? '' : 'missing_expiry',
        status === 'revoked' ? 'support_session_revoked' : '',
        status === 'expired' ? 'support_session_expired' : '',
        allowedActions.length ? '' : 'missing_allowed_actions',
        scope.length ? '' : 'missing_scope',
    ])
    return {
        schemaVersion: 'support.scoped_session.lifecycle_receipt.v1',
        generatedAt: new Date().toISOString(),
        actionType,
        outcome: status === 'expired' ? 'denied' : 'success',
        severity: status === 'active' ? 'notice' : 'warning',
        supportSessionId: input.supportSessionId,
        actorId: input.actorId,
        targetType: input.targetUserId ? 'user' : 'organization',
        targetId: input.targetUserId || input.organizationId || input.supportSessionId,
        organizationId: input.organizationId || null,
        entityId: input.supportSessionId,
        requestId: input.requestId,
        reason: input.reason,
        reasonPresent: Boolean(input.reason),
        scope,
        allowedActions,
        durationMinutes: input.durationMinutes || null,
        expiresAt: input.expiresAt,
        status,
        revokedBy: input.revokedBy || null,
        revokedAt: input.revokedAt || null,
        auditEventIds: input.auditEventIds,
        requiredFields: ['reason', 'organizationId|targetUserId', 'allowedActions', 'scope', 'expiresAt', 'requestId'],
        guardrails: {
            supportRoleRequired: true,
            reasonRequired: true,
            contextRecommended: true,
            scopeRequired: true,
            durationOrExpiryRequired: true,
            noCrossOrgLeakage: true,
            noSilentImpersonation: true,
            noSilentMembershipMutation: true,
            redactionRequired: true,
        },
        actionRoutes: workflowRoutes,
        nextActions: supportSessionNextActions({
            status,
            allowedActions,
            scope,
            workflowRoutes,
            organizationId: input.organizationId || '',
            targetUserId: input.targetUserId || '',
            supportSessionId: input.supportSessionId,
        }),
        replay: {
            current: auditFilterQuery({ supportSession: input.supportSessionId, source: 'admin', service: 'hanasand-api' }),
            request: auditFilterQuery({ request: input.requestId, supportSession: input.supportSessionId }),
            outcome: auditFilterQuery({ supportSession: input.supportSessionId, outcome: status === 'expired' ? 'denied' : 'success' }),
            action: auditFilterQuery({ supportSession: input.supportSessionId, action: actionType }),
            organization: input.organizationId ? auditFilterQuery({ org: input.organizationId, supportSession: input.supportSessionId }) : null,
            target: input.targetUserId ? auditFilterQuery({ target: input.targetUserId, supportSession: input.supportSessionId }) : null,
        },
        denialCases: [
            { code: 'missing_support_reason', field: 'reason', auditOutcome: 'denied' },
            { code: 'missing_support_target', field: 'organizationId|targetUserId', auditOutcome: 'denied' },
            { code: 'invalid_scope', field: 'scope', auditOutcome: 'denied' },
            { code: 'invalid_duration', field: 'durationMinutes', auditOutcome: 'denied' },
            { code: 'support_session_expired', field: 'expiresAt', auditOutcome: 'denied' },
            { code: 'support_session_revoked', field: 'status', auditOutcome: 'denied' },
            { code: 'support_session_scope_denied', field: 'scope', auditOutcome: 'denied' },
        ],
        blockers,
        copyText: [
            `Support session receipt ${status}: ${input.supportSessionId}`,
            `Action: ${actionType}`,
            `Org: ${input.organizationId || '*'}`,
            `User: ${input.targetUserId || '*'}`,
            `Scope: ${scope.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery({ supportSession: input.supportSessionId, source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}

function supportSessionNextActions(input: {
    status: string
    allowedActions: string[]
    scope: string[]
    workflowRoutes: Record<string, unknown>
    organizationId: string
    targetUserId: string
    supportSessionId: string
}) {
    const scope = new Set(input.scope)
    const active = input.status === 'active'
    const route = (key: string) => typeof input.workflowRoutes[key] === 'string' ? String(input.workflowRoutes[key]) : null
    const action = (name: string, method: 'GET' | 'POST', routeKey: string, requiredScope: string[], actionType: string) => ({
        name,
        method,
        route: route(routeKey),
        available: active && Boolean(route(routeKey)) && requiredScope.every(item => scope.has(item)),
        actionType,
        requiredScope,
        requiredFields: ['reason', 'context', 'supportSessionId', ...requiredScope.some(item => item.startsWith('invite:')) ? ['idempotencyKey'] : []],
        auditReplay: auditFilterQuery({
            supportSession: input.supportSessionId,
            action: actionType,
            org: input.organizationId,
            target: input.targetUserId,
        }),
    })
    return [
        action('Inspect support session', 'GET', 'detail', [], 'support.session.inspect'),
        action('Revoke support session', 'POST', 'revoke', [], 'support.session.revoke'),
        action('Create recovery invite', 'POST', 'inviteAssistance', ['invite:create'], 'support.organization.invite_assist'),
        action('Resend invite', 'POST', 'inviteResend', ['invite:resend'], 'support.organization.invite_resend'),
        action('Revoke invite', 'POST', 'inviteRevoke', ['invite:revoke'], 'support.organization.invite_revoke'),
        action('Open access recovery', 'POST', 'accessRecovery', ['recovery:invite'], 'support.organization.access_recovery'),
        action('Recover member role', 'POST', 'memberRoleRecovery', ['member:role_recovery'], 'support.organization.member_role_recovery'),
        action('Start scoped impersonation', 'POST', 'impersonation', ['read_profile'], 'impersonation.start'),
    ]
}
