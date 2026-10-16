/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx, expect } from './runtime.ts'
const { buildDwmWebhookDeliveryPreview, buildDwmWebhookDestinationContracts, filterDwmWebhookDeliveryEvidenceForVisibility } = webhooks
const { evidenceRows, orgEvidence, replayPayload, replayWorkflowAlert, secret } = ctx

const visibilityAllowedMember = ctx.visibilityAllowedMember = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const visibilityWrongOrg = ctx.visibilityWrongOrg = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const visibilityRemoved = ctx.visibilityRemoved = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'admin', status: 'removed', userActive: true, alertVisibilityPolicy: 'members' },
})
const visibilityDeactivated = ctx.visibilityDeactivated = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'owner', status: 'active', userActive: false, alertVisibilityPolicy: 'members' },
})
const visibilityAdminPolicyMember = ctx.visibilityAdminPolicyMember = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'admins' },
})
const visibilityAdminPolicyAdmin = ctx.visibilityAdminPolicyAdmin = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'admins' },
})

expect(visibilityAllowedMember.decision.allowed === true && visibilityAllowedMember.deliveryEvidence.length === orgEvidence.length, 'Members policy should allow active members to read evidence.', visibilityAllowedMember)
expect(visibilityWrongOrg.decision.allowed === false && visibilityWrongOrg.decision.reason === 'not_member' && visibilityWrongOrg.deliveryEvidence.length === 0, 'Visibility should deny wrong-org/nonmember evidence reads.', visibilityWrongOrg)
expect(visibilityRemoved.decision.allowed === false && visibilityRemoved.decision.reason === 'member_removed' && visibilityRemoved.deliveryEvidence.length === 0, 'Visibility should deny removed members.', visibilityRemoved)
expect(visibilityDeactivated.decision.allowed === false && visibilityDeactivated.decision.reason === 'member_deactivated' && visibilityDeactivated.deliveryEvidence.length === 0, 'Visibility should deny deactivated members.', visibilityDeactivated)
expect(visibilityAdminPolicyMember.decision.allowed === false && visibilityAdminPolicyMember.decision.reason === 'role_not_allowed' && visibilityAdminPolicyMember.deliveryEvidence.length === 0, 'Admin-only policy should deny member evidence reads.', visibilityAdminPolicyMember)
expect(visibilityAdminPolicyAdmin.decision.allowed === true && visibilityAdminPolicyAdmin.deliveryEvidence.length === orgEvidence.length, 'Admin-only policy should allow admins.', visibilityAdminPolicyAdmin)

const destinationContracts = ctx.destinationContracts = buildDwmWebhookDestinationContracts({
    destinations: [
        {
            id: 'destination_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Replay Discord',
            kind: 'discord',
            endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
            endpointHash: 'endpoint_replay_hash',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
            createdBy: 'owner_contract',
            lastTestedAt: '2026-06-28T12:04:00.000Z',
            lastTestStatus: 'dry_run',
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: '2026-06-28T12:00:00.000Z',
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T12:04:00.000Z',
        },
        {
            id: 'destination_disabled_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Disabled Discord',
            kind: 'discord',
            endpointHint: 'https://discord.com/api/webhooks/111111111/...',
            endpointHash: 'endpoint_disabled_hash',
            status: 'archived',
            events: ['dwm.alert.created'],
            createdBy: 'owner_contract',
            lastTestedAt: null,
            lastTestStatus: null,
            lastTestError: 'Disabled by owner',
            lastTestHttpStatus: null,
            lastDeliveryAt: null,
            createdAt: '2026-06-28T10:00:00.000Z',
            updatedAt: '2026-06-28T12:05:00.000Z',
        },
    ],
    deliveries: [
        ...evidenceRows,
        {
            id: 'delivery_test_contract',
            destinationId: 'destination_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'webhook_test',
            eventType: 'dwm.alert.test',
            status: 'dry_run',
            dryRun: true,
            endpointHint: 'https://discord.com/api/webhooks/987654321/...',
            endpointHash: 'endpoint_replay_hash',
            payloadHash: 'payload_test_hash',
            payload: replayPayload,
            responseStatus: null,
            responseBody: null,
            error: null,
            idempotencyKey: 'dwm.alert.test:org_contract:destination_replay_contract:webhook_test',
            watchlistId: 'test-watchlist',
            watchlistName: 'Webhook test watchlist',
            route: 'test_delivery',
            casePath: '/dwm',
            attemptedAt: '2026-06-28T12:04:00.000Z',
            createdAt: '2026-06-28T12:04:00.000Z',
        },
    ],
    auditEvents: [
        {
            id: 'audit_destination_created_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: null,
            action: 'destination.created',
            metadata: {},
            createdAt: '2026-06-28T11:00:00.000Z',
        },
        {
            id: 'audit_delivery_test_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_test_contract',
            action: 'delivery.tested',
            metadata: {},
            createdAt: '2026-06-28T12:04:01.000Z',
        },
        {
            id: 'audit_replay_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_replay_contract',
            action: 'delivery.replayed',
            metadata: {},
            createdAt: '2026-06-28T12:00:01.000Z',
        },
    ],
})
const destinationContract = ctx.destinationContract = destinationContracts[0]
const disabledDestinationContract = ctx.disabledDestinationContract = destinationContracts[1]
const deliveryPreview = ctx.deliveryPreview = buildDwmWebhookDeliveryPreview({
    id: 'delivery_replay_contract',
    destinationId: 'destination_replay_contract',
    ownerId: 'owner_contract',
    orgId: 'org_contract',
    alertId: 'alert_replay_contract',
    eventType: 'dwm.alert.replayed',
    status: 'dry_run',
    dryRun: true,
    endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
    endpointHash: 'endpoint_replay_hash',
    payloadHash: 'payload_replay_hash',
    payload: replayPayload,
    responseStatus: null,
    responseBody: null,
    error: null,
    idempotencyKey: 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract',
    watchlistId: 'watchlist_item_replay_contract',
    watchlistName: 'Replay contract watchlist',
    route: 'identity_response',
    casePath: replayWorkflowAlert.casePath,
    attemptedAt: '2026-06-28T12:00:00.000Z',
    createdAt: '2026-06-28T12:00:00.000Z',
    updatedAt: '2026-06-28T12:00:05.000Z',
})
const retryDeliveryPreview = ctx.retryDeliveryPreview = buildDwmWebhookDeliveryPreview({
    id: 'delivery_retry_preview_contract',
    destinationId: 'destination_live_contract',
    ownerId: 'owner_contract',
    orgId: 'org_contract',
    alertId: 'alert_retry_preview_contract',
    eventType: 'dwm.alert.created',
    status: 'failed',
    dryRun: false,
    endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`,
    endpointHash: 'endpoint_live_hash',
    payloadHash: 'payload_retry_preview_hash',
    payload: replayPayload,
    responseStatus: 503,
    responseBody: `retry failed with token=${secret}`,
    error: `upstream unavailable token=${secret}`,
    errorClass: 'upstream_5xx',
    attemptCount: 2,
    nextRetryAt: '2026-06-28T12:11:00.000Z',
    idempotencyKey: 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_retry_preview_contract',
    watchlistId: 'watchlist_item_replay_contract',
    watchlistName: 'Replay contract watchlist',
    route: 'identity_response',
    casePath: replayWorkflowAlert.casePath,
    attemptedAt: '2026-06-28T12:06:00.000Z',
    createdAt: '2026-06-28T12:06:00.000Z',
    updatedAt: '2026-06-28T12:06:05.000Z',
})
