/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx } from './runtime.ts'
const { buildDwmWebhookDashboardReadinessAdapter, buildDwmWebhookDeliveryOperations, buildDwmWebhookDeliveryRetryContract, buildDwmWebhookDeliveryRetryPersistence } = webhooks
const { auditDeliveryRows, operationAuditEvents, operationDestinations, replayWorkflowAlert } = ctx

const policyBlockedDashboardReadiness = ctx.policyBlockedDashboardReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'member', status: 'removed', userActive: true, alertVisibilityPolicy: 'members' },
})
const archivedOrgDashboardReadiness = ctx.archivedOrgDashboardReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
    orgStatus: 'archived',
})
const retiredWatchlistDashboardReadiness = ctx.retiredWatchlistDashboardReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
    watchlistStatus: 'retired',
})
const foreignDeliveryRetryPersistence = ctx.foreignDeliveryRetryPersistence = buildDwmWebhookDeliveryRetryPersistence({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_foreign' },
})
const deliveryOperationDetail = ctx.deliveryOperationDetail = buildDwmWebhookDeliveryOperations({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { requestId: 'delivery_replay_duplicate_contract' },
})
const deliveryOperationByCase = ctx.deliveryOperationByCase = buildDwmWebhookDeliveryOperations({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { casePath: replayWorkflowAlert.casePath, dedupeKey: 'dwm_dedupe_replay_contract' },
})
const retryHealthBlockedContract = ctx.retryHealthBlockedContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_live_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_live_contract',
        dedupeKey: 'dwm_dedupe_live_contract',
        dryRun: true,
        live: false,
    },
})
const duplicateDeliveredRetryContract = ctx.duplicateDeliveredRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_sent_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_sent_contract',
        dedupeKey: 'dwm_dedupe_sent_contract',
        dryRun: true,
        live: false,
    },
})
const disabledRetryContract = ctx.disabledRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_disabled_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_disabled_contract',
        dedupeKey: 'dwm_dedupe_disabled_contract',
        dryRun: true,
        live: false,
    },
})
const missingUrlRetryContract = ctx.missingUrlRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_missing_url_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_missing_url_contract',
        dedupeKey: 'dwm_dedupe_missing_url_contract',
        dryRun: true,
        live: false,
    },
})
const liveDisabledRetryContract = ctx.liveDisabledRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_replay_contract',
        eventType: 'dwm.alert.replayed',
        alert: replayWorkflowAlert,
        dryRun: false,
        live: true,
    },
})
const missingAlertRetryContract = ctx.missingAlertRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_replay_contract',
        eventType: 'dwm.alert.replayed',
        dryRun: true,
        live: false,
    },
})
const readOnlyRetryContract = ctx.readOnlyRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_live_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_live_contract',
        dedupeKey: 'dwm_dedupe_live_contract',
        dryRun: true,
        live: false,
    },
})
