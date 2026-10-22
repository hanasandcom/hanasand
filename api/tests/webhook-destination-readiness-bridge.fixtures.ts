import { dwmWebhookDestinationRow } from './fixtures/dwm-webhook-destination.ts'
import { organizationReadinessProof } from '../src/utils/organizations.ts'
import { buildDwmWebhookDeliveryReceipts, toDwmWebhookDelivery, toDwmWebhookDestination } from '../src/utils/dwm/webhooks.ts'

const destination = toDwmWebhookDestination(dwmWebhookDestinationRow())

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

export function organizationReadiness() {
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

export function organizationBridge() {
    return organizationReadiness().webhookDeliveryProof.webhookDestinationReadinessBridge
}

export function dwmBridge() {
    return dwmReadinessConsumer().orgDestinationReadinessBridge
}

export function dwmReadinessConsumer() {
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries: [delivery],
        destinations: [destination],
        liveDeliveryEnabled: false,
        canManage: true,
    })
    return receipts.receipts[0].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer
}
