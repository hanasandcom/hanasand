import { expect, test } from 'bun:test'
import {
    buildDwmWebhookDeliveryAttemptContract,
    buildDwmWebhookDeliveryAttemptPersistenceProof,
    buildDwmWebhookDeliveryRequestInput,
} from '../src/utils/dwm/webhooks.ts'

const webhookSecret = 'attempt-contract-secret-sentinel'

const alert = {
    id: 'alert_replay_contract',
    title: 'Replay Acme credential exposure',
    severity: 'high',
    company: 'Acme Security',
    domain: 'acme-security.com',
    sourceFamily: 'telegram_public',
    evidence: [
        { label: 'Public channel match', detail: 'Public channel message matched acme-security.com.', capturedAt: '2026-06-28T10:40:00.000Z' },
    ],
    matchedTerm: { value: 'acme-security.com', kind: 'domain' },
    dedupeKey: 'dwm_dedupe_replay_contract',
    casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract',
    alertUrl: 'https://app.hanasand.local/v1/cases/case_replay_contract?alertId=alert_replay_contract',
    deliveryState: 'ready_to_send',
    replayCount: 1,
    replayedAt: '2026-06-28T10:45:00.000Z',
    confidenceScore: 87,
    confidenceReason: 'Matched public source and case enrichment.',
    caseActionId: 'case_action_replay_contract',
    caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
    webhookContext: {
        alertId: 'alert_replay_contract',
        organizationId: 'org_contract',
        watchlistItemIds: ['watchlist_item_replay_contract'],
        sourceFamily: 'telegram_public',
        dedupeKey: 'dwm_dedupe_replay_contract',
        casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract',
        caseActionId: 'case_action_replay_contract',
        caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
        provenance: {
            captureIds: ['capture_replay_contract'],
            sourceIds: ['source_replay_contract'],
            primaryCaptureId: 'capture_replay_contract',
        },
    },
    watchlist: {
        id: 'watchlist_item_replay_contract',
        name: 'Replay contract watchlist',
        terms: ['acme-security.com'],
    },
}

const input = buildDwmWebhookDeliveryRequestInput({
    alert,
    eventType: 'dwm.alert.replayed',
    dryRun: true,
    live: false,
    destinationId: 'destination_replay_contract',
})

const destination = {
    id: 'destination_replay_contract',
    orgId: 'org_contract',
    ownerId: 'owner_contract',
    name: 'Replay Discord',
    kind: 'discord',
    endpointHint: `https://discord.com/api/webhooks/1234567890/${webhookSecret}`,
    endpointHash: 'endpoint_replay_contract',
    status: 'active',
    events: ['dwm.alert.created', 'dwm.alert.replayed'],
    createdBy: 'owner_contract',
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
    lastTestHttpStatus: null,
    lastDeliveryAt: null,
    createdAt: '2026-06-28T12:00:00.000Z',
    updatedAt: '2026-06-28T12:00:00.000Z',
}

const priorAttempt = {
    id: 'prior_attempt_contract',
    ownerId: 'owner_contract',
    orgId: 'org_contract',
    destinationId: 'destination_replay_contract',
    alertId: 'alert_replay_contract',
    eventType: 'dwm.alert.replayed' as const,
    status: 'dry_run' as const,
    dryRun: true,
    endpointHint: destination.endpointHint,
    endpointHash: destination.endpointHash,
    payloadHash: 'payload_replay_contract',
    payload: {
        content: 'DWM alert replay',
        embeds: [{
            title: 'Acme credential dump detected',
            fields: [
                { name: 'Watchlist', value: 'Replay contract watchlist', inline: true },
                { name: 'Alert URL', value: '/dwm/alerts/alert_replay_contract', inline: false },
            ],
        }],
        _hanasand: {
            alert: { id: 'alert_replay_contract', title: 'Acme credential dump detected' },
            watchlist: { id: 'watchlist_item_replay_contract', name: 'Replay contract watchlist' },
            delivery: { id: 'prior_attempt_contract', dedupeKey: 'dwm_dedupe_replay_contract', replay: true },
        },
    },
    responseStatus: null,
    responseBody: null,
    error: null,
    errorClass: null,
    attemptCount: 1,
    nextRetryAt: null,
    idempotencyKey: 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract',
    watchlistId: 'watchlist_item_replay_contract',
    watchlistName: 'Replay contract watchlist',
    route: 'review',
    casePath: alert.casePath,
    attemptedAt: '2026-06-28T12:00:00.000Z',
    createdAt: '2026-06-28T12:00:00.000Z',
}

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

test('delivery attempt contracts reject malformed, cross-org, and unsupported targets', () => {
    const missing = buildDwmWebhookDeliveryAttemptContract({
        ownerId: 'owner_contract',
        input: {
            orgId: '',
            eventType: 'dwm.alert.created',
            alert: {
                id: '',
                title: '',
                severity: '',
                sourceFamily: '',
                evidence: [],
                provenance: {},
                watchlist: {},
                dedupeKey: '',
                casePath: '',
            },
            dryRun: true,
        },
        destinations: [],
    })
    expect(missing.ok).toBe(false)
    expect(missing.blockers.map(item => item.code)).toContain('missing_alert_title')
    expect(missing.blockers.map(item => item.code)).toContain('missing_destination')
    expect(missing.payloadContract.missingRequired).toContain('orgId')
    expect(missing.payloadContract.missingRequired).toContain('title')
    expect(missing.payloadContract.missingRequired).toContain('dedupeKey')

    const wrongOrg = buildDwmWebhookDeliveryAttemptContract({
        ownerId: 'owner_contract',
        input,
        destinations: [{
            id: 'destination_wrong_org_contract',
            org_id: 'org_wrong',
            name: 'Wrong org Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        }],
    })
    expect(wrongOrg.ok).toBe(false)
    expect(wrongOrg.destinationSelection.skippedDestinations.some(item => item.reason === 'org_mismatch')).toBe(true)
    expect(wrongOrg.attempts.every(item => item.orgId === 'org_contract' && item.destinationId !== 'destination_wrong_org_contract')).toBe(true)

    const unsupported = buildDwmWebhookDeliveryAttemptContract({
        ownerId: 'owner_contract',
        input,
        destinations: [{
            id: 'destination_unsupported_contract',
            org_id: 'org_contract',
            name: 'Email destination',
            kind: 'email',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        } as never],
    })
    expect(unsupported.ok).toBe(false)
    expect(unsupported.blockers.some(item => item.code === 'unsupported_destination_type')).toBe(true)
    expect(unsupported.attempts[0]?.redactedDestination.endpointExposed).toBe(false)
})
