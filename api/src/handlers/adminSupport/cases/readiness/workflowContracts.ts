export function supportReadinessWorkflowContracts(supportSession: string) {
    return {
        inspect: {
            route: '/api/admin/support/inspect',
            method: 'GET',
            scope: ['read_org', 'read_profile', 'audit:read'],
            reasonRecommended: true,
        },
        scopedSession: {
            createRoute: '/api/admin/support/sessions',
            detailRoute: supportSession ? `/api/admin/support/sessions/${encodeURIComponent(supportSession)}` : '/api/admin/support/sessions/:sessionId',
            revokeRoute: supportSession ? `/api/admin/support/sessions/${encodeURIComponent(supportSession)}/revoke` : '/api/admin/support/sessions/:sessionId/revoke',
            reasonRequired: true,
            scopeRequired: true,
            durationRequired: true,
            expiryRequired: true,
            revocationSemantics: ['support_session_revoked', 'support_session_expired', 'support_session_scope_denied'],
        },
        inviteRecovery: {
            routeTemplate: '/api/admin/support/organizations/:id/invites/:inviteId/actions',
            supportedActions: ['resend', 'revoke'],
            reasonRequired: true,
            contextRequired: true,
            idempotencyRequired: true,
            expiryRequired: true,
            expectedAuditActions: ['support.organization.invite_resend', 'support.organization.invite_revoke'],
        },
        accessRecovery: {
            requestRouteTemplate: '/api/admin/support/organizations/:id/access-recovery',
            decisionRouteTemplates: ['/api/admin/support/access-recovery/:requestId/approve', '/api/admin/support/access-recovery/:requestId/deny'],
            reasonRequired: true,
            contextRequired: true,
            approvalAware: true,
            expectedReceiptSchemas: ['support.access_recovery.execution_receipt.v1', 'support.access_recovery.decision_receipt.v1'],
        },
        memberRecovery: {
            routeTemplate: '/api/admin/support/organizations/:id/members/:userId/role-recovery',
            reasonRequired: true,
            contextRequired: true,
            scopeRequired: true,
            idempotencyRequired: true,
            expectedReceiptSchemas: ['support.action_execute.member_role_recovery.v1', 'support.member_recovery.handoff_receipt.v1'],
        },
        impersonation: {
            route: '/api/impersonation/start',
            eventsRoute: '/api/impersonation/events',
            reasonRequired: true,
            scopeRequired: true,
            durationRequired: true,
            expectedReceiptSchemas: ['support.impersonation.lifecycle_receipt.v1'],
        },
    }
}
