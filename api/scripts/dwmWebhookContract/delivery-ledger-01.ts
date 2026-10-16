import { webhooks, context as ctx, expect } from './runtime.ts'
const { buildDwmWebhookDeliveryEvidence, buildDwmWebhookDeliveryLedger, planDwmWebhookDeliveryRetry } = webhooks
const { caseActionEvidence, caseActionPathEvidence, casePathEvidence, dedupeEvidence, destinationEvidence, evidenceAttempts, evidenceRows, idempotencyEvidence, liveEvidence, orgEvidence, replayEvidence, replayWorkflowAlert, secret, skippedLiveEvidence } = ctx

const retryLedgerRows = ctx.retryLedgerRows = [
    ...evidenceRows,
    {
        id: 'delivery_live_failed_retry_contract',
        destinationId: 'destination_live_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'alert_live_contract',
        eventType: 'dwm.alert.created' as const,
        status: 'failed' as const,
        dryRun: false,
        endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
        endpointHash: 'endpoint_live_hash',
        payloadHash: 'payload_live_retry_hash',
        payload: {},
        responseStatus: 503,
        responseBody: `retry failed with token=${secret}`,
        error: `upstream unavailable token=${secret}`,
        errorClass: 'upstream_5xx',
        attemptCount: 2,
        nextRetryAt: '2026-06-28T12:11:00.000Z',
        idempotencyKey: 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_live_contract',
        watchlistId: 'watchlist_item_live_contract',
        watchlistName: 'Live watchlist',
        route: 'customer_webhook',
        casePath: '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract',
        attemptedAt: '2026-06-28T12:06:00.000Z',
        createdAt: '2026-06-28T12:06:00.000Z',
    },
    {
        id: 'delivery_live_sent_contract',
        destinationId: 'destination_sent_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'alert_sent_contract',
        eventType: 'dwm.alert.created' as const,
        status: 'delivered' as const,
        dryRun: false,
        endpointHint: 'https://hooks.example.com/sent',
        endpointHash: 'endpoint_sent_hash',
        payloadHash: 'payload_sent_hash',
        payload: {},
        responseStatus: 204,
        responseBody: '',
        error: null,
        idempotencyKey: 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract',
        watchlistId: 'watchlist_item_sent_contract',
        watchlistName: 'Sent watchlist',
        route: 'customer_webhook',
        casePath: '/v1/cases/sent',
        attemptedAt: '2026-06-28T12:07:00.000Z',
        createdAt: '2026-06-28T12:07:00.000Z',
    },
    {
        id: 'delivery_live_terminal_contract',
        destinationId: 'destination_terminal_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'alert_terminal_contract',
        eventType: 'dwm.alert.created' as const,
        status: 'failed' as const,
        dryRun: false,
        endpointHint: `https://discord.com/api/webhooks/444444444/${secret}`,
        endpointHash: 'endpoint_terminal_hash',
        payloadHash: 'payload_terminal_hash',
        payload: {},
        responseStatus: 400,
        responseBody: `bad request token=${secret}`,
        error: `bad request token=${secret}`,
        idempotencyKey: 'dwm.alert.created:org_contract:destination_terminal_contract:dwm_dedupe_terminal_contract',
        watchlistId: 'watchlist_item_terminal_contract',
        watchlistName: 'Terminal watchlist',
        route: 'customer_webhook',
        casePath: '/v1/cases/terminal',
        attemptedAt: '2026-06-28T12:09:00.000Z',
        createdAt: '2026-06-28T12:09:00.000Z',
    },
]
const deliveryLedger = ctx.deliveryLedger = buildDwmWebhookDeliveryLedger({
    deliveries: retryLedgerRows,
    auditEvents: [
        {
            id: 'audit_live_retry_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_live_contract',
            deliveryId: 'delivery_live_failed_retry_contract',
            action: 'delivery.failed',
            metadata: { status: 'failed' },
            createdAt: '2026-06-28T12:06:01.000Z',
        },
    ],
    filters: { orgId: 'org_contract' },
})
const advancedDeliveryFilterAuditEvents = ctx.advancedDeliveryFilterAuditEvents = [
    {
        id: 'audit_live_retry_contract',
        ownerId: 'owner_contract',
        actorId: 'owner_contract',
        orgId: 'org_contract',
        destinationId: 'destination_live_contract',
        deliveryId: 'delivery_live_failed_retry_contract',
        action: 'delivery.failed',
        metadata: { status: 'failed' },
        createdAt: '2026-06-28T12:06:01.000Z',
    },
    {
        id: 'audit_live_sent_contract',
        ownerId: 'owner_contract',
        actorId: 'support_contract',
        orgId: 'org_contract',
        destinationId: 'destination_sent_contract',
        deliveryId: 'delivery_live_sent_contract',
        action: 'delivery.delivered',
        metadata: { status: 'delivered' },
        createdAt: '2026-06-28T12:07:01.000Z',
    },
]
const actionFilteredEvidence = ctx.actionFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', action: 'delivery.failed' } })
const statusFilteredEvidence = ctx.statusFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', status: 'sent' } })
const retryStateFilteredEvidence = ctx.retryStateFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', retryState: 'retry_scheduled' } })
const actorFilteredEvidence = ctx.actorFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', actorId: 'support_contract' } })
const timeFilteredEvidence = ctx.timeFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', timeFrom: '2026-06-28T12:06:30.000Z', timeTo: '2026-06-28T12:07:30.000Z' } })
const idempotencyKeyFilteredEvidence = ctx.idempotencyKeyFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', idempotencyKey: 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract' } })
const queuedLedger = ctx.queuedLedger = deliveryLedger.find(item => item.deliveryId === 'delivery_replay_contract')
const retryLedger = ctx.retryLedger = deliveryLedger.find(item => item.deliveryId === 'delivery_live_failed_retry_contract')
const skippedLedger = ctx.skippedLedger = deliveryLedger.find(item => item.deliveryId === 'delivery_live_skipped_contract')
const sentLedger = ctx.sentLedger = deliveryLedger.find(item => item.deliveryId === 'delivery_live_sent_contract')
const rateLimitRetry = ctx.rateLimitRetry = planDwmWebhookDeliveryRetry({
    status: 'failed',
    dryRun: false,
    responseStatus: 429,
    error: 'rate limited',
    attemptedAt: '2026-06-28T12:10:00.000Z',
    attemptCount: 1,
})

expect(evidenceAttempts.length === 4, 'Delivery evidence should include all unfiltered attempts.', evidenceAttempts)
expect(replayEvidence?.auditEventId === 'audit_replay_contract', 'Replay evidence should link audit event id.', replayEvidence)
expect(replayEvidence?.replay === true && replayEvidence.dryRun === true && replayEvidence.live === false && replayEvidence.liveRequested === false, 'Replay evidence should distinguish dry-run replay.', replayEvidence)
expect(replayEvidence?.dedupeKey === 'dwm_dedupe_replay_contract', 'Replay evidence should expose dedupe key.', replayEvidence)
expect(replayEvidence?.casePath === replayWorkflowAlert.casePath, 'Replay evidence should expose case path.', replayEvidence)
expect(liveEvidence?.live === true && liveEvidence.liveRequested === true && liveEvidence.dryRun === false && liveEvidence.replay === false, 'Live evidence should distinguish live non-replay attempts.', liveEvidence)
expect(liveEvidence?.response.httpStatus === 502, 'Live evidence should expose HTTP status.', liveEvidence)
expect(skippedLiveEvidence?.liveRequested === true && skippedLiveEvidence.live === false && skippedLiveEvidence.status === 'skipped', 'Skipped evidence should show live was requested but not externally sent.', skippedLiveEvidence)
expect(!JSON.stringify(evidenceAttempts).includes(secret), 'Delivery evidence should redact endpoint, response, and error secrets.', evidenceAttempts)
expect(orgEvidence.length === 3 && orgEvidence.every(item => item.orgId === 'org_contract'), 'Delivery evidence org filter should exclude wrong-org attempts.', orgEvidence)
expect(destinationEvidence[0]?.requestId === 'delivery_live_failed_contract', 'Delivery evidence should filter by destination id.', destinationEvidence)
expect(casePathEvidence.length === 1 && casePathEvidence[0].requestId === 'delivery_replay_contract', 'Delivery evidence should filter by case path.', casePathEvidence)
expect(caseActionEvidence.length === 1 && caseActionEvidence[0].caseActionId === 'case_action_replay_contract', 'Delivery evidence should filter by case action id.', caseActionEvidence)
expect(caseActionPathEvidence.length === 1 && caseActionPathEvidence[0].caseActionPath === replayWorkflowAlert.caseActionPath, 'Delivery evidence should filter by case action path.', caseActionPathEvidence)
expect(dedupeEvidence.length === 1 && dedupeEvidence[0].requestId === 'delivery_replay_contract', 'Delivery evidence should filter by dedupe key.', dedupeEvidence)
expect(idempotencyEvidence.length === 1 && idempotencyEvidence[0].requestId === 'delivery_replay_contract', 'Delivery evidence should filter by idempotency key.', idempotencyEvidence)
expect(buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { alertId: 'alert_replay_contract', casePath: replayWorkflowAlert.casePath, dedupeKey: 'dwm_dedupe_replay_contract' } }).length === 1, 'Delivery evidence should combine alert, case path, and dedupe filters.')
expect(actionFilteredEvidence.length === 1 && actionFilteredEvidence[0].requestId === 'delivery_live_failed_retry_contract' && actionFilteredEvidence[0].auditAction === 'delivery.failed', 'Delivery evidence should filter by audit action.', actionFilteredEvidence)
expect(statusFilteredEvidence.length === 1 && statusFilteredEvidence[0].requestId === 'delivery_live_sent_contract', 'Delivery evidence should filter by raw or derived delivery status.', statusFilteredEvidence)
expect(retryStateFilteredEvidence.length === 1 && retryStateFilteredEvidence[0].retryState === 'retry_scheduled', 'Delivery evidence should filter by retry/backoff state.', retryStateFilteredEvidence)
expect(actorFilteredEvidence.length === 1 && actorFilteredEvidence[0].actorId === 'support_contract', 'Delivery evidence should filter by audit actor without exposing secrets.', actorFilteredEvidence)
expect(timeFilteredEvidence.length === 1 && timeFilteredEvidence[0].requestId === 'delivery_live_sent_contract', 'Delivery evidence should filter by attempted time window.', timeFilteredEvidence)
expect(idempotencyKeyFilteredEvidence.length === 1 && idempotencyKeyFilteredEvidence[0].idempotencyKey.endsWith(':dwm_dedupe_sent_contract'), 'Delivery evidence should filter by explicit idempotency key.', idempotencyKeyFilteredEvidence)
expect(queuedLedger?.status === 'queued' && queuedLedger.rawStatus === 'dry_run' && queuedLedger.retryable === false, 'Delivery ledger should map dry-run attempts to queued/no-retry state.', queuedLedger)
expect(sentLedger?.status === 'sent' && sentLedger.retryable === false && sentLedger.responseStatus === 204, 'Delivery ledger should map delivered attempts to sent state.', sentLedger)
expect(retryLedger?.status === 'failed' && retryLedger.retryable === true && retryLedger.attemptCount === 2, 'Delivery ledger should expose retryable failed attempts and attempt count.', retryLedger)
expect(retryLedger?.nextRetryAt === '2026-06-28T12:11:00.000Z' && retryLedger.errorClass === 'upstream_5xx', 'Retry planner should use backoff from the latest failed attempt.', retryLedger)
expect(retryLedger?.retryState === 'retry_scheduled' && retryLedger.actorId === 'owner_contract', 'Delivery ledger should carry retry-state and audit actor filters.', retryLedger)
expect(retryLedger?.attemptCount === 2 && retryLedger.retryReason === 'upstream_retryable', 'Delivery ledger should preserve persisted retry metadata while keeping retry reason derivable.', retryLedger)
expect(skippedLedger?.status === 'skipped' && skippedLedger.retryable === false && skippedLedger.errorClass === 'live_delivery_disabled', 'Delivery ledger should keep live-disabled skipped attempts non-retryable.', skippedLedger)
expect(rateLimitRetry.retryable === true && rateLimitRetry.nextRetryAt === '2026-06-28T12:11:00.000Z' && rateLimitRetry.reason === 'rate_limited', 'Retry planner should retry rate-limited failed sends.', rateLimitRetry)
expect(!JSON.stringify(deliveryLedger).includes(secret), 'Delivery ledger should not expose endpoint, response, or error secrets.', deliveryLedger)
