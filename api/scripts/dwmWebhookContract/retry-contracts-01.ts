/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx } from './runtime.ts'
const { buildDwmWebhookCustomerSetupProof, buildDwmWebhookDashboardReadinessAdapter, buildDwmWebhookDeliveryReadinessConsumerProof, buildDwmWebhookDestinationDeliveryMatrix, buildDwmWebhookDestinationLookupContract, buildDwmWebhookDestinationTestContract } = webhooks
const { auditDeliveryRows, buildDeliveryRetryAccessContracts, deliveryRetryAccessScenarios, lifecycleStateAuditEvents, lifecycleStateDestinations, operationAuditEvents, operationDestinations } = ctx

const deliveryRetryByAccess = ctx.deliveryRetryByAccess = {
    admin: buildDeliveryRetryAccessContracts(deliveryRetryAccessScenarios.admin),
    member: buildDeliveryRetryAccessContracts(deliveryRetryAccessScenarios.member),
    nonmember: buildDeliveryRetryAccessContracts(deliveryRetryAccessScenarios.nonmember),
}
const deliveryRetryQueue = ctx.deliveryRetryQueue = deliveryRetryByAccess.admin.queue
const deliveryRetryRequest = ctx.deliveryRetryRequest = deliveryRetryByAccess.admin.request
const deliveryRetryWorkOrders = ctx.deliveryRetryWorkOrders = deliveryRetryByAccess.admin.workOrders
const deliveryAuditTrail = ctx.deliveryAuditTrail = deliveryRetryByAccess.admin.auditTrail
const replayDestinationTest = ctx.replayDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
})
const persistedOnlyDestinationTest = ctx.persistedOnlyDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_sent_contract') || null,
    deliveries: [],
    auditEvents: [],
    viewerRole: 'admin',
    canManage: true,
})
const disabledDestinationTest = ctx.disabledDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_disabled_contract') || null,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
})
const failedDestinationTest = ctx.failedDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_test_failed_contract') || null,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
})
const memberDeliveryRetryQueue = ctx.memberDeliveryRetryQueue = deliveryRetryByAccess.member.queue
const memberDeliveryRetryRequest = ctx.memberDeliveryRetryRequest = deliveryRetryByAccess.member.request
const memberDeliveryRetryWorkOrders = ctx.memberDeliveryRetryWorkOrders = deliveryRetryByAccess.member.workOrders
const memberDeliveryAuditTrail = ctx.memberDeliveryAuditTrail = deliveryRetryByAccess.member.auditTrail
const memberReplayDestinationTest = ctx.memberReplayDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'member',
    canManage: false,
})
const nonmemberDeliveryRetryQueue = ctx.nonmemberDeliveryRetryQueue = deliveryRetryByAccess.nonmember.queue
const nonmemberDeliveryRetryRequest = ctx.nonmemberDeliveryRetryRequest = deliveryRetryByAccess.nonmember.request
const nonmemberDeliveryRetryWorkOrders = ctx.nonmemberDeliveryRetryWorkOrders = deliveryRetryByAccess.nonmember.workOrders
const nonmemberDeliveryAuditTrail = ctx.nonmemberDeliveryAuditTrail = deliveryRetryByAccess.nonmember.auditTrail
const deliveryReadinessConsumer = ctx.deliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryReadinessConsumer = ctx.nonmemberDeliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const foreignDeliveryReadinessConsumer = ctx.foreignDeliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_foreign' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const destinationDeliveryMatrix = ctx.destinationDeliveryMatrix = buildDwmWebhookDestinationDeliveryMatrix({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const destinationLookup = ctx.destinationLookup = buildDwmWebhookDestinationLookupContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDestinationDeliveryMatrix = ctx.memberDestinationDeliveryMatrix = buildDwmWebhookDestinationDeliveryMatrix({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'member',
    canManage: false,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDestinationLookup = ctx.memberDestinationLookup = buildDwmWebhookDestinationLookupContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'member',
    canManage: false,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDestinationDeliveryMatrix = ctx.nonmemberDestinationDeliveryMatrix = buildDwmWebhookDestinationDeliveryMatrix({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDestinationLookup = ctx.nonmemberDestinationLookup = buildDwmWebhookDestinationLookupContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const dashboardReadiness = ctx.dashboardReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const dashboardLifecycleReadiness = ctx.dashboardLifecycleReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: lifecycleStateDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: lifecycleStateAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDashboardLifecycleReadiness = ctx.memberDashboardLifecycleReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: lifecycleStateDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: lifecycleStateAuditEvents,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const customerSetup = ctx.customerSetup = buildDwmWebhookCustomerSetupProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberCustomerSetup = ctx.nonmemberCustomerSetup = buildDwmWebhookCustomerSetupProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
