import { expect, test } from 'bun:test'
import { buildDwmWebhookDeliveryAttemptContract, buildDwmWebhookDeliveryAttemptPersistenceProof } from '../src/utils/dwm/webhooks.ts'
import { alert, destination, input, priorAttempt, webhookSecret } from './fixtures/dwm-webhook-delivery-attempt.ts'

test('delivery attempt contracts preserve request, replay, persistence, and audit proof', () => {
    expect(input.organizationId).toBe('org_contract')
    expect(input.destinationId).toBe('destination_replay_contract')
    expect(input.casePath).toBe(alert.casePath)
    expect(input.sourceFamily).toBe('telegram_public')
    expect(input.dryRun).toBe(true)
    expect(input.live).toBe(false)

    const contract = buildDwmWebhookDeliveryAttemptContract({
        ownerId: 'owner_contract',
        input,
        destinations: [destination],
        deliveries: [priorAttempt],
    })
    expect(contract.schemaVersion).toBe('dwm.webhook.delivery_attempt_contract.v1')
    expect(contract.ok, JSON.stringify(contract.blockers)).toBe(true)
    expect(contract.noNetwork).toBe(true)
    expect(contract.requiredFields.orgId).toBe(true)
    expect(contract.requiredFields.watchlistId).toBe(true)
    expect(contract.requiredFields.provenance).toBe(true)
    expect(contract.payloadContract.schemaVersion).toBe('dwm.webhook.delivery_payload_contract.v1')
    expect(Object.keys(contract.requiredFields)).toEqual([
        'orgId', 'destinationId', 'alertId', 'watchlistId', 'severity', 'title',
        'sourceFamily', 'evidence', 'provenance', 'timestamp', 'link', 'dedupeKey',
    ])
    expect(contract.requiredFields).toEqual(Object.fromEntries(
        contract.payloadContract.required.map(field => [field.key, field.present]),
    ))
    expect(contract.payloadContract.required.every(field => field.present)).toBe(true)
    expect(contract.payloadContract.required.some(field => field.key === 'dedupeKey' && field.paths.includes('alert.dedupeKey'))).toBe(true)
    expect(contract.payloadContract.optional.some(field => field.key === 'replayState' && field.present)).toBe(true)
    expect(contract.payloadContract.optional.some(field => field.key === 'caseAction' && field.present)).toBe(true)

    const attempt = contract.attempts[0]!
    expect(contract.destinationSelection.selectedDestinationIds).toEqual(['destination_replay_contract'])
    expect(contract.attempts).toHaveLength(1)
    expect(attempt.status).toBe('dry_run')
    expect(attempt.replay).toBe(true)
    expect(attempt.retry.attemptCount).toBe(2)
    expect(attempt.audit.expectedAction).toBe('delivery.tested')
    expect(attempt.redactedDestination.endpointExposed).toBe(false)
    expect(attempt.redactedDestination.endpointHash).toBe('endpoint_replay_contract')
    expect(attempt.redactedDestination.endpointHint).toBe('https://discord.com/api/webhooks/1234567890/...')
    expect(JSON.stringify(attempt)).not.toContain(webhookSecret)
    expect(attempt.sanitizedPayloadPreview?.discord.fieldNames).toContain('Delivery state')
    expect(attempt.sanitizedPayloadPreview?.discord.fieldNames).toContain('Match reason')
    expect(attempt.sanitizedPayloadPreview?.discord.fieldNames).toContain('Evidence timestamp')
    expect(attempt.sanitizedPayloadPreview?.discord.fieldNames).toContain('Case action')
    expect(attempt.sanitizedPayloadPreview?.context.watchlistId).toBe('watchlist_item_replay_contract')
    expect(attempt.sanitizedPayloadPreview?.context.deliveryState).toBe('ready_to_send')
    expect(attempt.sanitizedPayloadPreview?.context.evidenceTimestamp).toBe('2026-06-28T10:40:00.000Z')
    expect(attempt.sanitizedPayloadPreview?.context.caseActionId).toBe('case_action_replay_contract')
    expect(Boolean(attempt.sanitizedPayloadPreview?.context.matchReason)).toBe(true)

    const persistence = buildDwmWebhookDeliveryAttemptPersistenceProof({
        ownerId: 'owner_contract',
        input,
        destinations: [destination],
        deliveries: [priorAttempt],
        auditEvents: [{
            id: 'audit_attempt_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'prior_attempt_contract',
            action: 'delivery.replayed',
            metadata: { status: 'dry_run' },
            createdAt: '2026-06-28T12:00:01.000Z',
        }],
    })
    expect(persistence.schemaVersion).toBe('dwm.webhook.delivery_attempt_persistence.v1')
    expect(persistence.ok).toBe(true)
    expect(persistence.totals.persistedAttempts).toBe(1)
    expect(persistence.rows[0]?.persistedDeliveryId).toBe('prior_attempt_contract')
    expect(persistence.rows[0]?.audit.auditEventId).toBe('audit_attempt_contract')
    expect(persistence.rows[0]?.sanitizedPayloadPreview?.discord.fieldNames).toContain('Alert URL')
    expect(persistence.rows[0]?.replay).toBe(true)
    expect(persistence.rows[0]?.redactedDestination.endpointExposed).toBe(false)
    expect(persistence.rows[0]?.redactedDestination.endpointHash).toBe('endpoint_replay_contract')
    expect(persistence.rows[0]?.redactedDestination.endpointHint).toBe('https://discord.com/api/webhooks/1234567890/...')
    expect(JSON.stringify(persistence)).not.toContain(webhookSecret)
})
