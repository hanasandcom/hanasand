import { expect, test } from 'bun:test'
import { buildDwmWebhookDestinationCrudContract } from '../src/utils/dwm/webhooks.ts'
import { destination, orgId, ownerId } from './fixtures/dwm-webhook-core-contracts.ts'

test('destination CRUD receipts deny cross-org updates and report delivered idempotency', () => {
    const createInput = {
        orgId,
        label: 'Customer Discord',
        type: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/999999999/new-secret',
        channelName: '#alerts',
    }
    const create = buildDwmWebhookDestinationCrudContract({
        action: 'create', ownerId, viewerRole: 'admin', canManage: true, input: createInput,
    })
    const duplicate = buildDwmWebhookDestinationCrudContract({
        action: 'create', ownerId, viewerRole: 'admin', canManage: true,
        destinations: [{ ...destination, endpointHash: create.desired.redactedEndpoint.endpointHash! }],
        input: createInput,
    })
    const mismatch = buildDwmWebhookDestinationCrudContract({
        action: 'update', ownerId, viewerRole: 'admin', canManage: true,
        destination, destinations: [destination],
        input: { orgId: 'org_other', endpointUrl: 'https://discord.com/api/webhooks/123456789/rotated-secret' },
    })
    const alreadyDelivered = buildDwmWebhookDestinationCrudContract({
        action: 'test', ownerId, viewerRole: 'admin', canManage: true,
        destination: { ...destination, id: 'destination_already_sent', endpointHash: 'endpoint_already_sent' },
        destinations: [{ ...destination, id: 'destination_already_sent', endpointHash: 'endpoint_already_sent' }],
        deliveries: [{
            id: 'delivery_test_prior',
            destinationId: 'destination_already_sent',
            ownerId,
            orgId,
            alertId: 'webhook_test',
            eventType: 'dwm.alert.created',
            status: 'delivered',
            dryRun: false,
            endpointHint: destination.endpointHint,
            endpointHash: destination.endpointHash,
            payloadHash: 'payload_test_prior',
            payload: {},
            responseStatus: 204,
            responseBody: null,
            error: null,
            errorClass: null,
            attemptCount: 1,
            nextRetryAt: null,
            idempotencyKey: `dwm.alert.created:${orgId}:destination_already_sent:dedupe_webhook_contract`,
            watchlistId: null,
            watchlistName: null,
            route: null,
            casePath: null,
            attemptedAt: '2026-10-01T10:00:00.000Z',
            completedAt: '2026-10-01T10:00:00.000Z',
            deliveredAt: '2026-10-01T10:00:00.000Z',
            createdAt: '2026-10-01T10:00:00.000Z',
        }],
        input: { orgId },
    })
    const roleDenied = buildDwmWebhookDestinationCrudContract({
        action: 'update', ownerId, viewerRole: 'member', canManage: false,
        destination, destinations: [destination], input: { orgId, label: 'Member rename denied' },
    })

    expect(create).toMatchObject({ schemaVersion: 'dwm.webhook.destination_crud.v1', action: 'create', canApply: true, orgId })
    expect(create.desired).toMatchObject({ label: 'Customer Discord', channel: '#alerts', type: 'discord' })
    expect(create.managementRequest).toMatchObject({ method: 'POST', route: '/api/dwm/webhook-destinations', canSend: true })
    expect(create.destinationPersistenceReceipt).toMatchObject({ action: 'create', noNetwork: true, redactedTarget: { endpoint: { endpointExposed: false } } })
    expect(JSON.stringify(create)).not.toContain('new-secret')

    expect(duplicate.canApply).toBe(false)
    expect(duplicate.blockingCodes).toContain('duplicate_destination')
    expect(duplicate.destinationPersistenceReceipt.mutation.persisted).toBe(false)

    expect(mismatch.canApply).toBe(false)
    expect(mismatch.blockingCodes).toContain('org_scope_mismatch')
    expect(mismatch.managementRequest.canSend).toBe(false)
    expect(mismatch.destinationPersistenceReceipt.mutation.persisted).toBe(false)
    expect(mismatch.destinationPersistenceReceipt.denial.blockingCodes).toContain('org_scope_mismatch')
    expect(JSON.stringify(mismatch)).not.toContain('rotated-secret')

    expect(roleDenied.blockingCodes).toContain('permission_denied')
    expect(roleDenied.managementRequest.canSend).toBe(false)
    expect(roleDenied.destinationPersistenceReceipt.mutation.persisted).toBe(false)

    expect(alreadyDelivered.canApply).toBe(true)
    expect(alreadyDelivered.blockers).toContainEqual(expect.objectContaining({ code: 'idempotency_duplicate', blocking: false }))
    expect(alreadyDelivered.destinationPersistenceReceipt.idempotency.alreadyDelivered).toBe(true)
    expect(alreadyDelivered.destinationPersistenceReceipt).toMatchObject({ noNetwork: true, externalSendEnabled: false })
})
