export const orgId = 'org_webhook_contract'
export const ownerId = 'owner_webhook_contract'

export const alert = {
    id: 'alert_webhook_contract',
    organizationId: orgId,
    tenantId: orgId,
    title: 'Credential exposure',
    severity: 'high',
    firstSeenAt: '2026-10-01T10:00:00.000Z',
    sourceFamily: 'telegram_public',
    matchedTerm: { value: 'example.com', kind: 'domain' },
    evidence: [{ label: 'Public source', detail: 'Observed credential exposure.', capturedAt: '2026-10-01T10:00:00.000Z' }],
    provenance: { captureIds: ['capture_1'], sourceIds: ['source_1'] },
    dedupeKey: 'dedupe_webhook_contract',
    route: 'customer_discord',
    casePath: '/dwm?alert=alert_webhook_contract',
    alertUrl: 'https://app.hanasand.local/dwm?alert=alert_webhook_contract',
    watchlist: { id: 'watchlist_1', name: 'Customer domains', terms: ['example.com'] },
}

export const destination = {
    id: 'destination_webhook_contract',
    ownerId,
    orgId,
    name: 'Customer Discord',
    kind: 'discord' as const,
    endpointHint: 'https://discord.com/api/webhooks/123456789/…',
    endpointHash: 'endpoint_webhook_contract',
    status: 'active' as const,
    events: ['dwm.alert.created', 'dwm.alert.replayed'] as Array<'dwm.alert.created' | 'dwm.alert.replayed'>,
    createdBy: ownerId,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
    lastTestHttpStatus: null,
    lastDeliveryAt: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    signingConfigured: true,
}
