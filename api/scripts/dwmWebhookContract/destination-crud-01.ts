/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx } from './runtime.ts'
const { buildDwmWebhookDestinationCrudContract } = webhooks
const { auditDeliveryRows, operationAuditEvents, operationDestinations } = ctx

const crudCreateContract = ctx.crudCreateContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destinations: operationDestinations,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        label: 'Customer Discord',
        type: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/999999999/new-token',
        channelName: '#alerts',
        requestId: 'req_crud_create_contract',
    },
})
const crudDuplicateContract = ctx.crudDuplicateContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destinations: [
        ...operationDestinations,
        {
            id: 'destination_duplicate_endpoint_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Existing duplicate Discord',
            kind: 'discord' as const,
            endpointHint: crudCreateContract.desired.redactedEndpoint.endpointHint || 'https://discord.com/api/webhooks/999999999/...',
            endpointHash: crudCreateContract.desired.redactedEndpoint.endpointHash || 'endpoint_duplicate_hash',
            status: 'active' as const,
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
            createdBy: 'owner_contract',
            lastTestedAt: '2026-06-28T12:04:00.000Z',
            lastTestStatus: 'dry_run' as const,
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: null,
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T12:11:00.000Z',
        },
    ],
    input: {
        orgId: 'org_contract',
        name: 'Duplicate Discord',
        endpointUrl: 'https://discord.com/api/webhooks/999999999/new-token',
    },
})
const crudInvalidUrlContract = ctx.crudInvalidUrlContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destinations: operationDestinations,
    input: {
        orgId: 'org_contract',
        endpointUrl: 'http://insecure.example/webhook',
    },
})
const crudUnsupportedTypeContract = ctx.crudUnsupportedTypeContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destinations: operationDestinations,
    input: {
        orgId: 'org_contract',
        type: 'teams',
        endpointUrl: 'https://hooks.example.com/teams',
    },
})
const crudEntitlementDeniedContract = ctx.crudEntitlementDeniedContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    entitlementAllowed: false,
    destinations: operationDestinations,
    input: {
        orgId: 'org_contract',
        endpointUrl: 'https://hooks.example.com/denied',
    },
})
const crudUpdateContract = ctx.crudUpdateContract = buildDwmWebhookDestinationCrudContract({
    action: 'update',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        label: 'Renamed Discord',
        url: 'https://discord.com/api/webhooks/987654321/rotated-token',
        channel: '#security',
    },
})
const crudOrgScopeMismatchContract = ctx.crudOrgScopeMismatchContract = buildDwmWebhookDestinationCrudContract({
    action: 'update',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_other_contract',
        label: 'Moved Discord',
        url: 'https://discord.com/api/webhooks/987654321/move-token',
    },
})
const crudDisableContract = ctx.crudDisableContract = buildDwmWebhookDestinationCrudContract({
    action: 'disable',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract' },
})
const crudDeleteContract = ctx.crudDeleteContract = buildDwmWebhookDestinationCrudContract({
    action: 'delete',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract' },
})
const crudEnableContract = ctx.crudEnableContract = buildDwmWebhookDestinationCrudContract({
    action: 'enable',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_paused_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract', status: 'active' },
})
const crudTestContract = ctx.crudTestContract = buildDwmWebhookDestinationCrudContract({
    action: 'test',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract' },
})
const crudRoleDeniedContract = ctx.crudRoleDeniedContract = buildDwmWebhookDestinationCrudContract({
    action: 'update',
    ownerId: 'owner_contract',
    viewerRole: 'member',
    canManage: false,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract', label: 'Member rename denied' },
})
const crudIdempotencyContract = ctx.crudIdempotencyContract = buildDwmWebhookDestinationCrudContract({
    action: 'test',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_sent_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract' },
})
