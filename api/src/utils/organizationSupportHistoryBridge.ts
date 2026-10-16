export type OrganizationSupportHistoryReplayFilters = {
    organizationId: string
    targetUserId: string
    requestId: string
    action: string
}

export function buildOrganizationSupportHistoryBridge({
    replayFilters,
    required,
}: {
    replayFilters: OrganizationSupportHistoryReplayFilters
    required?: boolean
}) {
    return {
        schemaVersion: 'organization.member_recovery_support_history_bridge.v1',
        ...(required === undefined ? {} : { required }),
        source: 'support_audit_timeline',
        supportReceiptSchemas: [
            'support.access_recovery.execution_receipt.v1',
            'support.access_recovery.decision_receipt.v1',
            'support.action_execute.member_role_recovery.v1',
        ],
        expectedSupportActions: [
            'support.organization.access_recovery',
            'support.organization.access_recovery.approve',
            'support.organization.access_recovery.deny',
            'support.organization.member_role_recovery',
        ],
        replayFilters,
        supportRoutes: {
            inspect: '/api/admin/support/inspect',
            accessRecovery: '/api/admin/support/access-recovery/:requestId',
            organization: '/api/admin/support/organizations/:id',
            memberRoleRecovery: '/api/admin/support/organizations/:id/members/:userId/role-recovery',
        },
        requiredAuditFields: ['organizationId', 'targetUserId', 'requestId', 'supportSessionId', 'reason', 'outcome'],
        noSilentMembershipMutation: true,
        nonmemberEnumeration: false,
    }
}
