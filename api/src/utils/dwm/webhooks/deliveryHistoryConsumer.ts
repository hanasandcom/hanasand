import type {
    buildDwmWebhookDeliveryAttemptPersistenceReadModel,
    buildDwmWebhookDeliveryHistory,
} from '../webhooks.ts'
import { makeWebhookBlocker, uniqueWebhookBlockers } from '../webhookValueUtils.ts'

type DeliveryHistory = ReturnType<typeof buildDwmWebhookDeliveryHistory>
type AttemptReadModel = ReturnType<typeof buildDwmWebhookDeliveryAttemptPersistenceReadModel>

export function buildDwmWebhookDeliveryHistoryConsumerProjection(
    history: DeliveryHistory,
    attempts: AttemptReadModel,
    liveDeliveryEnabled: boolean,
) {
    const attemptByDeliveryId = new Map(attempts.rows.map(row => [row.deliveryId, row]))
    const rows = history.entries.map((entry) => {
        const attempt = attemptByDeliveryId.get(entry.deliveryId) || null
        const blockers = [
            ...(entry.destination.availability.code ? [makeWebhookBlocker(entry.destination.availability.code, entry.destination.availability.message, entry.destinationId, true)] : []),
            ...(!entry.deliveryProof.auditEventId ? [makeWebhookBlocker('audit_missing', 'Delivery attempt has no linked audit event yet.', entry.destinationId, false)] : []),
            ...(entry.retry.nextRetryAt ? [makeWebhookBlocker('retry_scheduled', 'Delivery has a scheduled retry/backoff time.', entry.destinationId, false)] : []),
            ...(attempt?.replayHistory.duplicateLiveBlocked ? [makeWebhookBlocker('duplicate_live_blocked', 'A live delivery for this destination and idempotency key was already delivered.', entry.destinationId, true)] : []),
            ...(!liveDeliveryEnabled && entry.liveRequested ? [makeWebhookBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', entry.destinationId, true)] : []),
        ]

        return {
            schemaVersion: 'dwm.webhook.delivery_history_consumer_row.v1',
            deliveryId: entry.deliveryId,
            requestId: entry.requestId,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alert.id,
            watchlistId: entry.watchlist.id,
            eventType: entry.eventType,
            status: entry.status,
            rawStatus: entry.rawStatus,
            dryRun: entry.dryRun,
            live: entry.live,
            replay: entry.replay,
            dedupeKey: entry.alert.dedupeKey,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            redactedDestination: {
                id: entry.destination.id,
                label: entry.destination.label,
                type: entry.destination.type,
                status: entry.destination.status,
                enabled: entry.destination.enabled,
                endpointHint: entry.destination.redactedEndpoint.endpointHint,
                endpointHash: entry.destination.redactedEndpoint.endpointHash,
                endpointExposed: false,
            },
            discord: {
                title: entry.discordPreview?.title || entry.alert.title || null,
                fieldNames: entry.discordPreview?.fieldNames || [],
                content: entry.discordPreview?.content || null,
                alertLink: entry.alert.alertUrl || entry.alert.casePath || null,
                template: entry.sanitizedPayloadPreview?.discordTemplate || null,
                safeForCustomerDisplay: entry.sanitizedPayloadPreview?.redaction.safeForCustomerDisplay === true,
            },
            alert: {
                title: entry.alert.title,
                severity: entry.alert.severity,
                sourceFamily: entry.alert.sourceFamily,
                evidenceCount: entry.alert.evidenceCount,
                casePath: entry.alert.casePath,
                alertUrl: entry.alert.alertUrl,
                caseActionId: entry.alert.caseActionId,
                caseActionPath: entry.alert.caseActionPath,
            },
            retry: {
                retryable: entry.retry.retryable,
                attemptCount: entry.retry.attemptCount,
                nextRetryAt: entry.retry.nextRetryAt,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: entry.retry.terminalFailure,
            },
            idempotency: attempt?.idempotency || {
                duplicate: entry.dedupe.duplicateAttemptCount > 0,
                duplicateAttemptCount: entry.dedupe.duplicateAttemptCount,
                alreadyDelivered: entry.dedupe.alreadyDelivered,
                deliveredDeliveryId: null,
                latestDeliveryId: entry.deliveryId,
                deliveryIds: [entry.deliveryId],
            },
            replayHistory: attempt?.replayHistory || {
                replay: entry.replay,
                replayAttemptCount: entry.replay ? 1 : 0,
                dryRunAttemptCount: entry.dryRun ? 1 : 0,
                liveAttemptCount: entry.live ? 1 : 0,
                duplicateReplay: entry.replay && entry.dedupe.duplicateAttemptCount > 0,
                duplicateLiveBlocked: false,
            },
            audit: {
                auditEventId: entry.deliveryProof.auditEventId,
                action: entry.deliveryProof.auditAction,
                linked: Boolean(entry.deliveryProof.auditEventId),
            },
            response: entry.deliveryProof.response,
            error: entry.deliveryProof.error,
            routes: {
                deliveryDetail: entry.operationLinks?.deliveryDetail || null,
                deliveryHistory: entry.operationLinks?.deliveryHistory || null,
                retryDryRun: entry.operationLinks?.retryDryRun || 'POST /api/dwm/webhook-deliveries',
                destinationTest: entry.operationLinks?.destinationTest || null,
                destinationDetail: entry.operationLinks?.destinationDetail || null,
            },
            timestamps: {
                createdAt: entry.deliveryProof.createdAt,
                updatedAt: entry.deliveryProof.updatedAt,
                attemptedAt: entry.deliveryProof.attemptedAt,
            },
            blockers: uniqueWebhookBlockers(blockers),
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_history_consumer.v1',
        noNetwork: true,
        externalSendEnabled: liveDeliveryEnabled,
        filters: history.filters,
        routes: {
            list: 'GET /api/dwm/webhook-deliveries',
            detail: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&deliveryId=<delivery_id>',
            retryDryRun: 'POST /api/dwm/webhook-deliveries',
        },
        routeContract: {
            schemaVersion: 'dwm.webhook.delivery_history_routes.v1',
            list: {
                method: 'GET' as const,
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId'],
                optionalQuery: ['destinationId', 'alertId', 'casePath', 'dedupeKey', 'deliveryId', 'idempotencyKey', 'action', 'status', 'timeFrom', 'timeTo', 'retryState', 'actorId'],
                noNetwork: true,
            },
            detail: {
                method: 'GET' as const,
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId', 'deliveryId'],
                optionalQuery: ['destinationId', 'alertId', 'dedupeKey', 'idempotencyKey', 'action', 'status', 'retryState', 'actorId'],
                responseRowSchema: 'dwm.webhook.delivery_history_consumer_row.v1',
                noNetwork: true,
            },
            retryDryRun: {
                method: 'POST' as const,
                route: '/api/dwm/webhook-deliveries',
                requiredBody: ['orgId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun'],
                noNetworkDefault: true,
            },
        },
        counts: {
            total: rows.length,
            auditLinked: rows.filter(row => row.audit.linked).length,
            retryScheduled: rows.filter(row => row.retry.nextRetryAt).length,
            duplicateReplay: rows.filter(row => row.replayHistory.duplicateReplay).length,
            duplicateLiveBlocked: rows.filter(row => row.replayHistory.duplicateLiveBlocked).length,
            redactedDestinations: rows.filter(row => row.redactedDestination.endpointExposed === false).length,
        },
        rows,
        blockers: rows.length
            ? []
            : [{
                code: 'no_delivery_history',
                message: 'No webhook delivery history matched the current filters.',
                blocking: false,
            }],
    }
}
