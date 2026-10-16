export type DwmWebhookKind = 'webhook' | 'discord'
export type DwmWebhookStatus = 'active' | 'paused' | 'archived'
export type DwmAlertEventType = 'dwm.alert.created' | 'dwm.alert.updated' | 'dwm.alert.replayed' | 'dwm.alert.test'

export type DwmWebhookDestinationRow = {
    id: string
    owner_id: string
    org_id: string
    name: string
    kind: DwmWebhookKind
    endpoint_encrypted: string
    endpoint_hint: string
    endpoint_hash: string
    status: DwmWebhookStatus
    events: string[]
    created_by: string
    last_tested_at: string | null
    last_test_status: 'dry_run' | 'delivered' | 'failed' | 'skipped' | null
    last_test_error: string | null
    last_test_http_status: number | null
    last_delivery_at: string | null
    created_at: string
    updated_at: string
}

export type DwmWebhookDeliveryRow = {
    id: string
    destination_id: string | null
    owner_id: string
    org_id: string
    alert_id: string
    event_type: DwmAlertEventType
    status: 'dry_run' | 'delivered' | 'failed' | 'skipped'
    dry_run: boolean
    endpoint_hint: string
    endpoint_hash: string
    payload_hash: string
    payload: unknown
    response_status: number | null
    response_body: string | null
    error: string | null
    error_class: string | null
    attempt_count: number | null
    next_retry_at: string | null
    idempotency_key: string
    watchlist_id: string | null
    watchlist_name: string | null
    route: string | null
    case_path: string | null
    attempted_at: string | null
    completed_at: string | null
    delivered_at: string | null
    created_at: string
    updated_at?: string
    audit_event_id?: string | null
    audit_action?: string | null
    audit_actor_id?: string | null
    report_validation?: string | null
    report_export_checksum?: string | null
    report_case_id?: string | null
}

export type DwmWebhookAuditRow = {
    id: string
    owner_id: string
    actor_id: string
    org_id: string
    destination_id: string | null
    delivery_id: string | null
    action: string
    metadata: unknown
    created_at: string
}

export type DwmWebhookDestinationInput = {
    orgId?: unknown
    name?: unknown
    label?: unknown
    kind?: unknown
    type?: unknown
    endpointUrl?: unknown
    endpoint_url?: unknown
    webhookUrl?: unknown
    webhook_url?: unknown
    signingSecret?: unknown
    signing_secret?: unknown
    rotateSigningSecret?: unknown
    rotate_signing_secret?: unknown
    url?: unknown
    channel?: unknown
    channelName?: unknown
    channel_name?: unknown
    status?: unknown
    events?: unknown
    requestId?: unknown
    request_id?: unknown
    entitlementAllowed?: unknown
    entitlement_allowed?: unknown
}

export type DwmAlertNotificationInput = {
    orgId?: unknown
    organizationId?: unknown
    tenantId?: unknown
    destinationId?: unknown
    destination_id?: unknown
    eventType?: unknown
    event_type?: unknown
    alertId?: unknown
    watchlistItemId?: unknown
    watchlistId?: unknown
    watchlistName?: unknown
    dedupeKey?: unknown
    route?: unknown
    recommendedRoute?: unknown
    casePath?: unknown
    caseUrl?: unknown
    evidenceCount?: unknown
    sourceFamily?: unknown
    deliveryId?: unknown
    alert?: Record<string, unknown>
    dryRun?: unknown
    dry_run?: unknown
    live?: unknown
}
