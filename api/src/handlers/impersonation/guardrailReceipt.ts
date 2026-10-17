import { supportText } from '#utils/support/adminSupportInput.ts'

export function supportImpersonationGuardrailReceipt(input: {
    actorId: string
    targetId: string
    organizationId: string
    supportSessionId: string
    requestId: string
    reason: string
    scope: string[]
    durationMinutes: number | null
    expiresAt: string | null
    outcome: 'success' | 'denied'
    blocker: string
    message: string
    auditEventIds: number[]
}) {
    return {
        schemaVersion: 'support.impersonation.guardrail_receipt.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noSilentImpersonation: true,
        supportRoleRequired: true,
        reasonRequired: true,
        scopeRequired: true,
        durationRequired: true,
        supportSessionRequired: true,
        actorId: input.actorId,
        target: {
            type: 'user',
            id: input.targetId,
            organizationId: input.organizationId || null,
            supportSessionId: input.supportSessionId || null,
        },
        requestId: input.requestId,
        reasonPresent: Boolean(supportText(input.reason)),
        scope: input.scope,
        durationMinutes: input.durationMinutes,
        expiresAt: input.expiresAt,
        outcome: input.outcome,
        blockerCode: input.blocker || null,
        message: input.message,
        auditEventIds: input.auditEventIds,
        replayFilters: {
            audit: `/api/admin/audit-events?request=${encodeURIComponent(input.requestId)}&action=impersonation.start&source=admin&service=hanasand-api`,
            denied: '/api/admin/audit-events?action=impersonation.start&outcome=denied&source=admin&service=hanasand-api',
            target: `/api/admin/audit-events?target=${encodeURIComponent(input.targetId)}&action=impersonation.start&source=admin&service=hanasand-api`,
            supportSession: input.supportSessionId ? `/api/admin/audit-events?entity=${encodeURIComponent(input.supportSessionId)}&action=impersonation.start&source=admin&service=hanasand-api` : null,
        },
        nextRoutes: {
            lifecycle: input.supportSessionId ? `/api/impersonation/events?supportSession=${encodeURIComponent(input.supportSessionId)}` : `/api/impersonation/events?target=${encodeURIComponent(input.targetId)}`,
            supportSession: input.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}` : null,
            auditDetails: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        },
        denialCases: [
            'impersonation_support_required',
            'missing_target_user',
            'missing_support_reason',
            'invalid_duration',
            'invalid_scope',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_required',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'support_session_duration_exceeds_scope',
        ],
        blockers: [
            input.outcome === 'denied' && input.blocker ? input.blocker : '',
            supportText(input.reason) ? '' : 'missing_support_reason',
            input.scope.length ? '' : 'invalid_scope',
            input.durationMinutes ? '' : 'invalid_duration',
            input.auditEventIds.length ? '' : 'audit_unavailable',
        ].filter(Boolean),
        copyText: [
            `Support impersonation guardrail ${input.outcome}`,
            `Actor: ${input.actorId}`,
            `Target: ${input.targetId}`,
            `Session: ${input.supportSessionId || 'none'}`,
            `Duration: ${input.durationMinutes || 'none'}`,
            `Blocker: ${input.blocker || 'none'}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
