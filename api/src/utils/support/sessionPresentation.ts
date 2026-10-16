import { auditFilterQuery, uniqueTimelineValues } from './inspectionPackets.ts'
import { supportText as text } from './adminSupportInput.ts'

export function supportSessionResponse(input: {
    supportSessionId: string
    actorId: string
    reason: string
    requestId: string
    organizationId?: string | null
    targetUserId?: string | null
    allowedActions?: string[]
    scope?: string[]
    durationMinutes?: number
    expiresAt: string
    status: string
    revokedBy?: string | null
    revokedAt?: string | null
    auditEventIds: number[]
}) {
    const lifecycleReceipt = supportSessionLifecycleReceipt(input)
    return {
        schemaVersion: 'support.scoped_session.v1',
        id: input.supportSessionId,
        status: input.status,
        actorId: input.actorId,
        target: {
            organizationId: input.organizationId || null,
            userId: input.targetUserId || null,
        },
        reason: input.reason,
        allowedActions: input.allowedActions || [],
        scope: input.scope || [],
        durationMinutes: input.durationMinutes || null,
        expiresAt: input.expiresAt,
        revokedBy: input.revokedBy || null,
        revokedAt: input.revokedAt || null,
        requestId: input.requestId,
        outcome: input.status === 'active' ? 'success' : input.status === 'revoked' ? 'success' : 'denied',
        auditEventIds: input.auditEventIds,
        lifecycleReceipt,
        audit: {
            actionType: lifecycleReceipt.actionType,
            source: 'admin',
            service: 'hanasand-api',
            eventIds: input.auditEventIds,
            query: lifecycleReceipt.replay.current,
        },
        copyText: [
            `Support session ${input.status}`,
            `Session: ${input.supportSessionId}`,
            `Org: ${input.organizationId || '*'}`,
            `User: ${input.targetUserId || '*'}`,
            `Expires: ${input.expiresAt}`,
            `Request: ${input.requestId}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Reason: ${input.reason}`,
        ].join('\n'),
    }
}

function supportSessionLifecycleReceipt(input: {
    supportSessionId: string
    actorId: string
    reason: string
    requestId: string
    organizationId?: string | null
    targetUserId?: string | null
    allowedActions?: string[]
    scope?: string[]
    durationMinutes?: number
    expiresAt: string
    status: string
    revokedBy?: string | null
    revokedAt?: string | null
    auditEventIds: number[]
}) {
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

export function supportSessionWorkflowRoutes(input: {
    supportSessionId: string
    organizationId?: string | null
    targetUserId?: string | null
    allowedActions?: string[]
    scope?: string[]
}) {
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

export function supportSessionAuthorizationProof(input: {
    actorId: string
    supportSessionId: string
    state: {
        actorId: string
        organizationId?: string | null
        targetUserId?: string | null
        allowedActions?: string[]
        scope?: string[]
        status?: string
        reason?: string
        requestId?: string
        expiresAt?: string
        auditEventIds?: number[]
    }
    workflowRoutes: Record<string, unknown>
}) {
    const status = text(input.state.status) || 'unknown'
    const blockers = [
        status === 'active' ? '' : status === 'revoked' ? 'support_session_revoked' : 'support_session_expired',
        input.actorId === input.state.actorId ? '' : 'support_session_actor_mismatch',
        input.state.reason ? '' : 'missing_support_reason',
        input.state.expiresAt ? '' : 'missing_expiry',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.scoped_session.authorization_proof.v1',
        supportRoleRequired: true,
        supportSessionId: input.supportSessionId,
        actor: {
            id: input.actorId,
            sessionActorId: input.state.actorId,
            matchesSessionActor: input.actorId === input.state.actorId,
        },
        target: {
            organizationId: input.state.organizationId || null,
            userId: input.state.targetUserId || null,
        },
        allowedActions: input.state.allowedActions || [],
        scope: input.state.scope || [],
        status,
        expiresAt: input.state.expiresAt || null,
        requestId: input.state.requestId || null,
        reasonPresent: Boolean(input.state.reason),
        guardrails: {
            noCrossOrgLeakage: true,
            noSilentImpersonation: true,
            noSilentMembershipMutation: true,
            reasonRequired: true,
            scopeRequired: true,
            durationOrExpiryRequired: true,
            redactionRequired: true,
        },
        blockers,
        workflowRoutes: input.workflowRoutes,
        audit: {
            eventIds: input.state.auditEventIds || [],
            timeline: auditFilterQuery({
                supportSession: input.supportSessionId,
                entity: input.supportSessionId,
                request: input.state.requestId || '',
                source: 'admin',
                service: 'hanasand-api',
            }),
        },
        redacted: true,
        copyText: [
            `Support session authorization ${input.supportSessionId}`,
            `Status: ${status}`,
            `Actor: ${input.actorId}`,
            `Target org: ${input.state.organizationId || '*'}`,
            `Target user: ${input.state.targetUserId || '*'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}

