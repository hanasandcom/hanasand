/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx } from './runtime.ts'
const { buildDwmWebhookDeliveryActionPlan, buildDwmWebhookDeliveryReplayApiContract, buildDwmWebhookDeliveryReplayGuard, buildDwmWebhookDeliveryTimeline } = webhooks
const { auditDeliveryRows, operationAuditEvents, operationDestinations } = ctx

const deliveryTimeline = ctx.deliveryTimeline = buildDwmWebhookDeliveryTimeline({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const foreignDeliveryTimeline = ctx.foreignDeliveryTimeline = buildDwmWebhookDeliveryTimeline({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_foreign' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryTimeline = ctx.nonmemberDeliveryTimeline = buildDwmWebhookDeliveryTimeline({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryActionPlan = ctx.deliveryActionPlan = buildDwmWebhookDeliveryActionPlan({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryActionPlan = ctx.nonmemberDeliveryActionPlan = buildDwmWebhookDeliveryActionPlan({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryReplayGuard = ctx.deliveryReplayGuard = buildDwmWebhookDeliveryReplayGuard({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryReplayApi = ctx.deliveryReplayApi = buildDwmWebhookDeliveryReplayApiContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract', destinationId: 'destination_replay_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryReplayGuard = ctx.nonmemberDeliveryReplayGuard = buildDwmWebhookDeliveryReplayGuard({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryReplayApi = ctx.nonmemberDeliveryReplayApi = buildDwmWebhookDeliveryReplayApiContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract', destinationId: 'destination_replay_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
