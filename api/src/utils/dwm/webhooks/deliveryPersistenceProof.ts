import type { buildDwmWebhookDeliveryHistory } from '../webhooks.ts'
import { makeWebhookBlocker, uniqueWebhookBlockers } from '../webhookValueUtils.ts'

type DeliveryHistory = ReturnType<typeof buildDwmWebhookDeliveryHistory>

export function buildDwmWebhookDeliveryPersistenceProofFromHistory(
    history: DeliveryHistory,
    liveDeliveryEnabled: boolean,
) {
    const rows = history.entries.map((entry) => {
        const replayBlockers = deliveryPersistenceReplayBlockers(entry, liveDeliveryEnabled)
        const dryRunReplayBlocked = replayBlockers.filter(blocker => blocker.blocking && blocker.code !== 'live_delivery_disabled')
        const replayIdempotencyKey = [
            'dwm.alert.replayed',
            entry.orgId,
            entry.destinationId,
            entry.alert.dedupeKey,
        ].filter(Boolean).join(':')
        const replayBody = entry.orgId && entry.destinationId && entry.alert.id && entry.alert.dedupeKey
            ? {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                watchlistItemId: entry.watchlist.id,
                watchlistId: entry.watchlist.id,
                watchlistName: entry.watchlist.name,
                caseId: entry.alert.caseId,
                casePath: entry.alert.casePath,
                caseActionId: entry.alert.caseActionId,
                caseActionPath: entry.alert.caseActionPath,
                dedupeKey: entry.alert.dedupeKey,
                eventType: 'dwm.alert.replayed' as const,
                dryRun: true,
                live: false,
                idempotencyKey: replayIdempotencyKey,
            }
            : null
        return {
            schemaVersion: 'dwm.webhook.delivery_persistence_row.v1',
            requestId: entry.requestId,
            deliveryId: entry.deliveryId,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alert.id,
            watchlistId: entry.watchlist.id,
            watchlistName: entry.watchlist.name,
            caseId: entry.alert.caseId,
            casePath: entry.alert.casePath,
            status: entry.status,
            rawStatus: entry.rawStatus,
            dryRun: entry.dryRun,
            live: entry.live,
            replay: entry.replay,
            eventType: entry.eventType,
            dedupeKey: entry.alert.dedupeKey,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            payloadHash: entry.deliveryProof.payloadHash,
            sanitizedPayloadPreview: entry.sanitizedPayloadPreview,
            responseSummary: entry.deliveryProof.response.summary,
            error: entry.deliveryProof.error,
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: entry.retry.attemptCount,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: entry.retry.terminalFailure,
            },
            audit: {
                auditEventId: entry.deliveryProof.auditEventId,
                auditAction: entry.deliveryProof.auditAction,
                expectedAuditActions: entry.replay
                    ? ['delivery.replayed', 'delivery.failed', 'delivery.retry_scheduled']
                    : ['delivery.created', 'delivery.failed', 'delivery.retry_scheduled'],
            },
            actionRequests: {
                deliveryHistory: {
                    method: 'GET' as const,
                    route: 'GET /api/dwm/webhook-deliveries',
                    query: {
                        orgId: entry.orgId,
                        destinationId: entry.destinationId,
                        alertId: entry.alert.id,
                        watchlistId: entry.watchlist.id,
                        casePath: entry.alert.casePath,
                        caseActionId: entry.alert.caseActionId,
                        caseActionPath: entry.alert.caseActionPath,
                        dedupeKey: entry.alert.dedupeKey,
                        deliveryId: entry.deliveryId,
                    },
                    expectedAuditActions: ['delivery.created', 'delivery.replayed', 'delivery.failed', 'delivery.retry_scheduled'],
                    noNetwork: true as const,
                },
                dryRunReplay: {
                    method: 'POST' as const,
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: replayBody !== null && dryRunReplayBlocked.length === 0,
                    noNetwork: true as const,
                    body: replayBody,
                    expectedAuditAction: 'delivery.replayed',
                    blockers: dryRunReplayBlocked,
                },
                liveReplay: {
                    method: 'POST' as const,
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: replayBody !== null && liveDeliveryEnabled && replayBlockers.length === 0,
                    noNetwork: true as const,
                    body: replayBody ? { ...replayBody, dryRun: false, live: true } : null,
                    expectedAuditAction: 'delivery.replayed',
                    blockers: replayBlockers,
                },
            },
            operationLinks: entry.operationLinks,
            timestamps: {
                createdAt: entry.deliveryProof.createdAt,
                updatedAt: entry.deliveryProof.updatedAt,
                attemptedAt: entry.deliveryProof.attemptedAt,
            },
        }
    })
    const blockers = rows.length
        ? []
        : [{
            code: 'missing_delivery_attempt',
            ownerLane: 'webhook',
            path: 'deliveryHistory.entries',
            message: 'No persisted webhook delivery attempts matched the requested filters.',
            blocking: true,
        }]
    const auditEventIds = [...new Set(rows.map(row => row.audit.auditEventId).filter(Boolean) as string[])]

    return {
        schemaVersion: 'dwm.webhook.delivery_persistence_proof.v1',
        liveDeliveryEnabled,
        filters: history.filters,
        ok: blockers.length === 0,
        redacted: true,
        totals: {
            rows: rows.length,
            persisted: rows.filter(row => row.status === 'sent' || row.dryRun).length,
            failed: rows.filter(row => row.status === 'failed').length,
            skipped: rows.filter(row => row.status === 'skipped').length,
            retryScheduled: rows.filter(row => row.retry.retryable).length,
            dryRun: rows.filter(row => row.dryRun).length,
            live: rows.filter(row => row.live).length,
            replay: rows.filter(row => row.replay).length,
            auditLinked: auditEventIds.length,
        },
        audit: {
            eventType: 'dwm.webhook.delivery_persistence_checked',
            outcome: blockers.length === 0 ? 'ready' : 'blocked',
            auditEventIds,
        },
        blockers,
        rows,
    }
}

function deliveryPersistenceReplayBlockers(
    entry: DeliveryHistory['entries'][number],
    liveDeliveryEnabled: boolean,
) {
    const blockers: ReturnType<typeof makeWebhookBlocker>[] = []
    if (!entry.orgId || !entry.destinationId || !entry.alert.id || !entry.alert.dedupeKey) {
        blockers.push(makeWebhookBlocker('missing_alert_context', 'Replay requires organization, destination, alert, and dedupe context.', entry.destinationId, true))
    }
    if (entry.destination.availability.state === 'missing_destination') {
        blockers.push(makeWebhookBlocker('destination_unavailable', entry.destination.availability.message, entry.destinationId, true))
    }
    if (entry.retry.terminalFailure) {
        blockers.push(makeWebhookBlocker('terminal_failure', 'Latest delivery failure is terminal and should be remediated before replay.', entry.destinationId, true))
    }
    if (entry.dedupe.alreadyDelivered && entry.status === 'skipped') {
        blockers.push(makeWebhookBlocker('dedupe_already_delivered', 'A live delivery already exists for this destination and idempotency key.', entry.destinationId, true))
    }
    if (!liveDeliveryEnabled) {
        blockers.push(makeWebhookBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; replay proof is dry-run only.', entry.destinationId, false))
    }
    return uniqueWebhookBlockers(blockers)
}
