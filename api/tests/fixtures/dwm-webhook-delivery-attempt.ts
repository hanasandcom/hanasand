import { buildDwmWebhookDeliveryRequestInput } from '../../src/utils/dwm/webhooks.ts'

export const webhookSecret = 'attempt-contract-secret-sentinel'

export const alert = {
    id: 'alert_replay_contract',
    title: 'Replay Acme credential exposure',
    severity: 'high',
    company: 'Acme Security',
    domain: 'acme-security.com',
    sourceFamily: 'telegram_public',
    evidence: [
        { label: 'Public channel match', detail: 'Public channel message matched acme-security.com.', capturedAt: '2026-06-28T10:40:00.000Z' },
    ],
    matchedTerm: { value: 'acme-security.com', kind: 'domain' },
    dedupeKey: 'dwm_dedupe_replay_contract',
    casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract',
    alertUrl: 'https://app.hanasand.local/v1/cases/case_replay_contract?alertId=alert_replay_contract',
    deliveryState: 'ready_to_send',
    replayCount: 1,
    replayedAt: '2026-06-28T10:45:00.000Z',
    confidenceScore: 87,
    confidenceReason: 'Matched public source and case enrichment.',
    caseActionId: 'case_action_replay_contract',
    caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
    webhookContext: {
        alertId: 'alert_replay_contract',
        organizationId: 'org_contract',
        watchlistItemIds: ['watchlist_item_replay_contract'],
        sourceFamily: 'telegram_public',
        dedupeKey: 'dwm_dedupe_replay_contract',
        casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract',
        caseActionId: 'case_action_replay_contract',
        caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
        provenance: {
            captureIds: ['capture_replay_contract'],
            sourceIds: ['source_replay_contract'],
            primaryCaptureId: 'capture_replay_contract',
        },
    },
    watchlist: {
        id: 'watchlist_item_replay_contract',
        name: 'Replay contract watchlist',
        terms: ['acme-security.com'],
    },
}

export const input = buildDwmWebhookDeliveryRequestInput({
    alert,
    eventType: 'dwm.alert.replayed',
    dryRun: true,
    live: false,
    destinationId: 'destination_replay_contract',
})

export const destination = {
    id: 'destination_replay_contract',
    orgId: 'org_contract',
    ownerId: 'owner_contract',
    name: 'Replay Discord',
    kind: 'discord',
    endpointHint: `https://discord.com/api/webhooks/1234567890/${webhookSecret}`,
    endpointHash: 'endpoint_replay_contract',
    status: 'active',
    events: ['dwm.alert.created', 'dwm.alert.replayed'],
    createdBy: 'owner_contract',
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
    lastTestHttpStatus: null,
    lastDeliveryAt: null,
    createdAt: '2026-06-28T12:00:00.000Z',
    updatedAt: '2026-06-28T12:00:00.000Z',
}

export const priorAttempt = {
    id: 'prior_attempt_contract',
    ownerId: 'owner_contract',
    orgId: 'org_contract',
    destinationId: 'destination_replay_contract',
    alertId: 'alert_replay_contract',
    eventType: 'dwm.alert.replayed' as const,
    status: 'dry_run' as const,
    dryRun: true,
    endpointHint: destination.endpointHint,
    endpointHash: destination.endpointHash,
    payloadHash: 'payload_replay_contract',
    payload: {
        content: 'DWM alert replay',
        embeds: [{
            title: 'Acme credential dump detected',
            fields: [
                { name: 'Watchlist', value: 'Replay contract watchlist', inline: true },
                { name: 'Alert URL', value: '/dwm/alerts/alert_replay_contract', inline: false },
            ],
        }],
        _hanasand: {
            alert: { id: 'alert_replay_contract', title: 'Acme credential dump detected' },
            watchlist: { id: 'watchlist_item_replay_contract', name: 'Replay contract watchlist' },
            delivery: { id: 'prior_attempt_contract', dedupeKey: 'dwm_dedupe_replay_contract', replay: true },
        },
    },
    responseStatus: null,
    responseBody: null,
    error: null,
    errorClass: null,
    attemptCount: 1,
    nextRetryAt: null,
    idempotencyKey: 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract',
    watchlistId: 'watchlist_item_replay_contract',
    watchlistName: 'Replay contract watchlist',
    route: 'review',
    casePath: alert.casePath,
    attemptedAt: '2026-06-28T12:00:00.000Z',
    createdAt: '2026-06-28T12:00:00.000Z',
}
