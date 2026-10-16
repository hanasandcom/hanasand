import { expect, test } from 'bun:test'
import { organizationReadinessProof } from '../src/utils/organizations.ts'
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

function organizationBridge() {
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
    return organizationReadinessProof(input).webhookDeliveryProof.webhookDestinationReadinessBridge
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
