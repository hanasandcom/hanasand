import { expect, test } from 'bun:test'
import { dwmReadinessConsumer, dwmSupportHistoryBridge, organizationSupportHistoryBridge } from './webhook-destination-readiness-bridge.fixtures.ts'

test('organization and DWM support history bridges preserve their exact variant contracts', () => {
    const shared = {
        schemaVersion: 'organization.member_recovery_support_history_bridge.v1',
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
    const organization = organizationSupportHistoryBridge()
    const dwm = dwmSupportHistoryBridge()

    expect(organization).toEqual({
        schemaVersion: shared.schemaVersion,
        source: shared.source,
        supportReceiptSchemas: shared.supportReceiptSchemas,
        expectedSupportActions: shared.expectedSupportActions,
        replayFilters: { organizationId: 'org', targetUserId: 'target', requestId: 'request', action: 'action' },
        supportRoutes: shared.supportRoutes,
        requiredAuditFields: shared.requiredAuditFields,
        noSilentMembershipMutation: shared.noSilentMembershipMutation,
        nonmemberEnumeration: shared.nonmemberEnumeration,
    })
    expect(Object.keys(organization)).toEqual([
        'schemaVersion', 'source', 'supportReceiptSchemas', 'expectedSupportActions', 'replayFilters',
        'supportRoutes', 'requiredAuditFields', 'noSilentMembershipMutation', 'nonmemberEnumeration',
    ])
    expect(dwm).toEqual({
        schemaVersion: shared.schemaVersion,
        required: false,
        source: shared.source,
        supportReceiptSchemas: shared.supportReceiptSchemas,
        expectedSupportActions: shared.expectedSupportActions,
        replayFilters: {
            organizationId: 'org_1',
            targetUserId: '<target_user_id>',
            requestId: 'delivery_1',
            action: 'support.organization.access_recovery',
        },
        supportRoutes: shared.supportRoutes,
        requiredAuditFields: shared.requiredAuditFields,
        noSilentMembershipMutation: shared.noSilentMembershipMutation,
        nonmemberEnumeration: shared.nonmemberEnumeration,
    })
    expect(Object.keys(dwm)).toEqual([
        'schemaVersion', 'required', 'source', 'supportReceiptSchemas', 'expectedSupportActions', 'replayFilters',
        'supportRoutes', 'requiredAuditFields', 'noSilentMembershipMutation', 'nonmemberEnumeration',
    ])

    const consumer = dwmReadinessConsumer()
    expect(consumer.routeContract.supportHistory).toEqual({
        method: 'GET',
        route: '/api/admin/support/inspect',
        requiredQuery: ['organizationId', 'targetUserId', 'requestId', 'action'],
        expectedSchemaVersion: shared.schemaVersion,
        noNetwork: true,
    })
})
