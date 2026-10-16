import { expect, test } from 'bun:test'
import { organizationReadinessProof, type OrganizationReadinessProof } from '../src/utils/organizations.ts'
import { buildDwmWebhookDeliveryReceipts, toDwmWebhookDelivery, toDwmWebhookDestination } from '../src/utils/dwm/webhooks.ts'

const destination = toDwmWebhookDestination({
    id: 'destination_1',
    owner_id: 'owner_1',
    org_id: 'org_1',
    name: 'Receiver',
    kind: 'webhook',
    endpoint_encrypted: 'https://receiver.example/hook',
    endpoint_hint: 'receiver.example/...',
    endpoint_hash: 'endpoint_hash_1',
    status: 'active',
    events: ['dwm.alert.updated'],
    created_by: 'owner_1',
    last_tested_at: null,
    last_test_status: null,
    last_test_error: null,
    last_test_http_status: null,
    last_delivery_at: null,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
})

const payload = {
    schemaVersion: 'dwm.webhook.v1',
    alert: {
        id: 'alert_1',
        title: 'Evidence-backed alert',
        severity: 'medium',
        sourceFamily: 'clear_web',
        evidenceCount: 1,
        dedupeKey: 'case_1',
        casePath: '/dwm?alert=alert_1',
        provenance: { captureIds: ['capture_1'], sourceIds: ['source_1'] },
    },
    watchlist: { id: 'watch_1', name: 'Example domains', terms: ['example.com'] },
    delivery: { dedupeKey: 'case_1', route: 'customer_webhook', casePath: '/dwm?alert=alert_1' },
}

const delivery = toDwmWebhookDelivery({
    id: 'delivery_1',
    destination_id: 'destination_1',
    owner_id: 'owner_1',
    org_id: 'org_1',
    alert_id: 'alert_1',
    event_type: 'dwm.alert.updated',
    status: 'delivered',
    dry_run: false,
    endpoint_hint: destination.endpointHint,
    endpoint_hash: destination.endpointHash,
    payload_hash: 'payload_hash_1',
    payload,
    response_status: 204,
    response_body: null,
    error: null,
    error_class: null,
    attempt_count: 1,
    next_retry_at: null,
    idempotency_key: 'dwm.alert.updated:org_1:destination_1:case_1',
    watchlist_id: 'watch_1',
    watchlist_name: 'Example domains',
    route: 'customer_webhook',
    case_path: '/dwm?alert=alert_1',
    attempted_at: '2026-10-01T10:00:01.000Z',
    completed_at: '2026-10-01T10:00:02.000Z',
    delivered_at: '2026-10-01T10:00:02.000Z',
    created_at: '2026-10-01T10:00:00.000Z',
})

function organizationReadiness() {
    const input = {
        lifecycleReadiness: {
            lifecycleStatus: 'active',
            typedBlockers: [],
            counts: { activeMemberCount: 1, activeAdminCount: 1, pendingInviteCount: 0, sharedWatchlistCount: 1 },
        },
        alertGenerationBridge: {
            canGenerateAlerts: true,
            blockedReasons: [],
            activeWatchlistTerms: [{ watchlistItemId: 'watch_1' }],
        },
        downstreamAuthorization: {
            organizationId: 'org_1',
            tenantId: 'tenant_1',
            member: { userId: 'owner_1', role: 'owner', status: 'active' },
            visibility: { allowed: true, reason: null },
            allowedActions: [],
            watchlists: { pausedCount: 0, archivedCount: 0 },
            downstream: {
                alertGeneration: { canExportActiveTerms: true, blockerCodes: [] },
                webhook: { defaultPolicy: 'manual_selection', canUseDefaultDestinations: false, denialReason: null },
            },
        },
    } as unknown as Parameters<typeof organizationReadinessProof>[0]
    return organizationReadinessProof(input)
}

function organizationBridge() {
    return organizationReadiness().webhookDeliveryProof.webhookDestinationReadinessBridge
}

function organizationSupportHistoryBridge() {
    return organizationReadiness().memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge
}

function dwmBridge() {
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries: [delivery],
        destinations: [destination],
        liveDeliveryEnabled: false,
        canManage: true,
    })
    return receipts.receipts[0].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge
}

function dwmSupportHistoryBridge() {
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries: [delivery],
        destinations: [destination],
        liveDeliveryEnabled: false,
        canManage: true,
    })
    return receipts.receipts[0].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.supportRecoveryBridge
}

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

    const consumer = buildDwmWebhookDeliveryReceipts({
        deliveries: [delivery],
        destinations: [destination],
        liveDeliveryEnabled: false,
        canManage: true,
    }).receipts[0].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer
    expect(consumer.routeContract.supportHistory).toEqual({
        method: 'GET',
        route: '/api/admin/support/inspect',
        requiredQuery: ['organizationId', 'targetUserId', 'requestId', 'action'],
        expectedSchemaVersion: shared.schemaVersion,
        noNetwork: true,
    })
})

test('organization and DWM readiness bridges share ordered contract fields', () => {
    const organization = organizationBridge()
    const dwm = dwmBridge()

    expect(Object.keys(organization)).toEqual([
        'schemaVersion', 'deliveryContractSchema', 'sourceContract', 'route', 'defaultWebhookPolicy',
        'canUseDefaultDestinations', 'selectedDestinationSource', 'requiredDestinationOrgId',
        'selectedDestinationOrgField', 'selectedDestinationIdField', 'ownerAdminManualTriggerRequired',
        'memberManualTriggerAllowed', 'requiredAlertFields', 'expectedDeliveryFields',
        'skippedDestinationReasons', 'lifecycleBlockers', 'blockerCodes', 'nonmemberDestinationEnumeration',
    ])
    expect(Object.keys(dwm)).toEqual([
        'schemaVersion', 'deliveryContractSchema', 'sourceContract', 'route', 'noNetwork', 'ready',
        'defaultWebhookPolicy', 'canUseDefaultDestinations', 'selectedDestinationSource',
        'requiredDestinationOrgId', 'selectedDestinationOrgField', 'selectedDestinationIdField',
        'ownerAdminManualTriggerRequired', 'memberManualTriggerAllowed', 'requiredAlertFields',
        'expectedDeliveryFields', 'selectedDestination', 'skippedDestinationReasons', 'lifecycleBlockers',
        'blockerCodes', 'nonmemberDestinationEnumeration', 'retry', 'idempotency', 'redaction',
    ])
    for (const field of [
        'schemaVersion', 'deliveryContractSchema', 'sourceContract', 'route', 'selectedDestinationOrgField',
        'selectedDestinationIdField', 'ownerAdminManualTriggerRequired', 'memberManualTriggerAllowed',
        'requiredAlertFields', 'expectedDeliveryFields', 'skippedDestinationReasons', 'lifecycleBlockers',
        'nonmemberDestinationEnumeration',
    ] as const) {
        expect(dwm[field]).toEqual(organization[field])
    }
    expect(organization).toMatchObject({
        defaultWebhookPolicy: 'manual_selection',
        canUseDefaultDestinations: false,
        selectedDestinationSource: 'manual_selection_required',
        requiredDestinationOrgId: 'org_1',
    })
    expect(dwm).toMatchObject({
        noNetwork: true,
        ready: true,
        defaultWebhookPolicy: 'manual_selection',
        canUseDefaultDestinations: false,
        selectedDestinationSource: 'manual_selection',
        requiredDestinationOrgId: 'org_1',
        selectedDestination: { id: 'destination_1', orgId: 'org_1', endpointExposed: false },
        retry: { retryable: false, attemptCount: 1 },
        idempotency: { key: 'dwm.alert.updated:org_1:destination_1:case_1', dedupeKey: 'case_1' },
        redaction: { safeForCustomerDisplay: true, endpointExposed: false, webhookSecretExposed: false },
    })
})

test('organization readiness proof keeps its stable top-level response shape', () => {
    const readiness: OrganizationReadinessProof = organizationReadiness()

    expect(Object.keys(readiness)).toEqual([
        'schemaVersion', 'organizationId', 'tenantId', 'actor', 'counts', 'readiness', 'routes',
        'worker3Proof', 'alertQueueProof', 'caseAssignmentProof', 'webhookDeliveryProof',
        'destinationOwnershipProof', 'memberLifecycleProof', 'inviteLifecycleProof',
        'lifecycleCleanupProof', 'tenMemberWorkspaceProof', 'alertGenerationHandoff', 'uiProof',
        'cleanupProof', 'customerWorkflowProof', 'auditTimelineProof', 'blockers',
    ])
    expect(readiness.schemaVersion).toBe('organization.worker3_ui_readiness_proof.v1')
    const requiredQueryFields: ['organizationId'] = readiness.alertQueueProof.requiredQueryFields
    const replayRoute: 'POST /v1/dwm/alerts/:id/replay' = readiness.alertQueueProof.routes.replay
    expect(requiredQueryFields).toEqual(['organizationId'])
    expect(replayRoute).toBe('POST /v1/dwm/alerts/:id/replay')

    const nestedFields = readiness.alertQueueProof.expectedVisibilityFields
    const originalNestedFields = [...nestedFields]
    nestedFields.push('temporary.mutable-field')
    expect(nestedFields).toContain('temporary.mutable-field')
    nestedFields.pop()
    expect(nestedFields).toEqual(originalNestedFields)
})
