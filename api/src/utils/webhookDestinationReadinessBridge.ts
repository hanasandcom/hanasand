export type WebhookDestinationSelectionSource = 'org_active_destinations' | 'manual_selection' | 'manual_selection_required' | 'webhook_policy_disabled'
export type WebhookDefaultPolicy = 'active_destinations' | 'manual_selection' | 'disabled'

type WebhookDestinationReadinessBridgeInput<TSource extends WebhookDestinationSelectionSource = WebhookDestinationSelectionSource> = {
    defaultWebhookPolicy: WebhookDefaultPolicy
    canUseDefaultDestinations: boolean
    selectedDestinationSource: TSource
    requiredDestinationOrgId: string
    blockerCodes: string[]
}

type DwmWebhookDestinationReadiness = {
    ready: boolean
    selectedDestination: {
        id: string
        orgId: string
        label: string | null
        type: string | null
        endpointHash: string | null
        endpointExposed: false
        status: string | null
        enabled: boolean | null
    } | null
    retry: {
        retryable: boolean
        nextRetryAt: string | null
        attemptCount: number
        terminalFailure: boolean
    }
    idempotency: {
        key: string | null
        dedupeKey: string | null
    }
}

type DwmBridgeInput<TSource extends WebhookDestinationSelectionSource = WebhookDestinationSelectionSource> = WebhookDestinationReadinessBridgeInput<TSource> & {
    dwmReadiness: DwmWebhookDestinationReadiness
}

type WebhookDestinationReadinessBridge<TSource extends WebhookDestinationSelectionSource = WebhookDestinationSelectionSource> = {
    schemaVersion: 'organization.webhook_destination_readiness_bridge.v1'
    deliveryContractSchema: 'dwm.webhook.org_alert_delivery.v1'
    sourceContract: 'organization.watchlist_webhook_delivery_contract.v1'
    route: 'POST /v1/dwm/webhooks/deliver'
    defaultWebhookPolicy: WebhookDefaultPolicy
    canUseDefaultDestinations: boolean
    selectedDestinationSource: TSource
    requiredDestinationOrgId: string
    selectedDestinationOrgField: 'destination.org_id'
    selectedDestinationIdField: 'webhookDestinationIds[]'
    ownerAdminManualTriggerRequired: true
    memberManualTriggerAllowed: false
    requiredAlertFields: string[]
    expectedDeliveryFields: string[]
    skippedDestinationReasons: ['org_mismatch', 'destination_disabled', 'event_not_subscribed', 'manual_selection_required', 'webhook_policy_disabled']
    lifecycleBlockers: ['org_archived', 'org_deleted', 'watchlist_paused', 'watchlist_archived', 'member_revoked', 'nonmember_denied']
    blockerCodes: string[]
    nonmemberDestinationEnumeration: false
}

export function buildWebhookDestinationReadinessBridge<TSource extends WebhookDestinationSelectionSource>(input: WebhookDestinationReadinessBridgeInput<TSource> & { dwmReadiness?: never }): WebhookDestinationReadinessBridge<TSource>
export function buildWebhookDestinationReadinessBridge<TSource extends WebhookDestinationSelectionSource>(input: DwmBridgeInput<TSource>): WebhookDestinationReadinessBridge<TSource> & {
    noNetwork: true
    ready: boolean
    selectedDestination: DwmWebhookDestinationReadiness['selectedDestination']
    retry: DwmWebhookDestinationReadiness['retry']
    idempotency: DwmWebhookDestinationReadiness['idempotency']
    redaction: { safeForCustomerDisplay: true, endpointExposed: false, webhookSecretExposed: false }
}
export function buildWebhookDestinationReadinessBridge(input: WebhookDestinationReadinessBridgeInput | DwmBridgeInput) {
    const dwm = 'dwmReadiness' in input ? input.dwmReadiness : null
    return {
        schemaVersion: 'organization.webhook_destination_readiness_bridge.v1' as const,
        deliveryContractSchema: 'dwm.webhook.org_alert_delivery.v1' as const,
        sourceContract: 'organization.watchlist_webhook_delivery_contract.v1' as const,
        route: 'POST /v1/dwm/webhooks/deliver' as const,
        ...(dwm ? { noNetwork: true as const, ready: dwm.ready } : {}),
        defaultWebhookPolicy: input.defaultWebhookPolicy,
        canUseDefaultDestinations: input.canUseDefaultDestinations,
        selectedDestinationSource: input.selectedDestinationSource,
        requiredDestinationOrgId: input.requiredDestinationOrgId,
        selectedDestinationOrgField: 'destination.org_id' as const,
        selectedDestinationIdField: 'webhookDestinationIds[]' as const,
        ownerAdminManualTriggerRequired: true as const,
        memberManualTriggerAllowed: false as const,
        requiredAlertFields: [
            'alert.id',
            'alert.organizationId',
            'alert.tenantId',
            'alert.watchlistItemIds',
            'alert.workflowContext.alertGenerationRefs',
            'alert.workflowContext.alertGeneratorKeys',
        ],
        expectedDeliveryFields: [
            'organizationId',
            'tenantId',
            'destinationId',
            'eventType',
            'payload.alert.id',
            'payload.alert.organizationId',
            'payload.watchlist.watchlistItemIds',
            'delivery.idempotencyKey',
        ],
        ...(dwm ? { selectedDestination: dwm.selectedDestination } : {}),
        skippedDestinationReasons: [
            'org_mismatch',
            'destination_disabled',
            'event_not_subscribed',
            'manual_selection_required',
            'webhook_policy_disabled',
        ] as ['org_mismatch', 'destination_disabled', 'event_not_subscribed', 'manual_selection_required', 'webhook_policy_disabled'],
        lifecycleBlockers: [
            'org_archived',
            'org_deleted',
            'watchlist_paused',
            'watchlist_archived',
            'member_revoked',
            'nonmember_denied',
        ] as ['org_archived', 'org_deleted', 'watchlist_paused', 'watchlist_archived', 'member_revoked', 'nonmember_denied'],
        blockerCodes: input.blockerCodes,
        nonmemberDestinationEnumeration: false as const,
        ...(dwm ? {
            retry: dwm.retry,
            idempotency: dwm.idempotency,
            redaction: {
                safeForCustomerDisplay: true as const,
                endpointExposed: false as const,
                webhookSecretExposed: false as const,
            },
        } : {}),
    }
}
