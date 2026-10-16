/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx } from './runtime.ts'
const { buildDwmWebhookDestinationAdminProof } = webhooks
const { auditDeliveryRows, operationAuditEvents, operationDestinations } = ctx

const destinationAdminProof = ctx.destinationAdminProof = buildDwmWebhookDestinationAdminProof({
    liveDeliveryEnabled: false,
    viewerRole: 'admin',
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const destinationAdminProofDetail = ctx.destinationAdminProofDetail = {
    ...destinationAdminProof,
    destinations: destinationAdminProof.destinations.filter(item => item.destinationId === 'destination_replay_contract'),
}
const memberDestinationAdminProof = ctx.memberDestinationAdminProof = buildDwmWebhookDestinationAdminProof({
    liveDeliveryEnabled: false,
    viewerRole: 'member',
    canManage: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDestinationAdminProof = ctx.nonmemberDestinationAdminProof = buildDwmWebhookDestinationAdminProof({
    liveDeliveryEnabled: false,
    viewerRole: null,
    canManage: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const replayDestinationProof = ctx.replayDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_replay_contract')
const retryDestinationProof = ctx.retryDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_live_contract')
const disabledDestinationProof = ctx.disabledDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_disabled_contract')
const skippedDestinationProof = ctx.skippedDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_skipped_contract')
const sentDestinationProof = ctx.sentDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_sent_contract')
const missingUrlDestinationProof = ctx.missingUrlDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_missing_url_contract')
const memberReplayDestinationProof = ctx.memberReplayDestinationProof = memberDestinationAdminProof.destinations.find(item => item.destinationId === 'destination_replay_contract')
