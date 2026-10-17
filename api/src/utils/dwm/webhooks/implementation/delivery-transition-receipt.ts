import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { dedupeFromIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { type buildDwmWebhookDeliveryHistory } from './webhook-visibility-decision.ts'
import { type buildDwmWebhookDeliveryRetryPersistence } from './delivery-read-projections.ts'
import { retryQueueBlocker, deliveryReceiptContext } from './retry-queue-blocker.ts'
import { buildDwmWebhookCaseActionDryRunReceipt } from './case-action-dry-run-receipt.ts'

export function buildDwmWebhookDeliveryTransitionReceipt({
    entry,
    retryKey,
    blockers,
    access,
    liveDeliveryEnabled,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    retryKey: ReturnType<typeof buildDwmWebhookDeliveryRetryPersistence>['deliveryKeys'][number] | null
    blockers: ReturnType<typeof retryQueueBlocker>[]
    access: { canRetry: boolean }
    liveDeliveryEnabled: boolean
}) {
    const receiptContext = deliveryReceiptContext(entry)
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const canDryRunRetry = access.canRetry && entry.retry.retryable && blockingCodes.length === 0
    const canLiveRetry = canDryRunRetry && liveDeliveryEnabled
    const dedupeKey = retryKey?.dedupe.latestDedupeKey || entry.alert.dedupeKey || dedupeFromIdempotencyKey(entry.deliveryProof.idempotencyKey)
    const retryBody = {
        orgId: entry.orgId,
        organizationId: entry.orgId,
        destinationId: entry.destinationId,
        eventType: entry.eventType,
        alertId: entry.alert.id,
        dedupeKey,
        route: entry.route,
        casePath: entry.alert.casePath,
        caseId: entry.alert.caseId,
        watchlistItemId: entry.watchlist.id,
        watchlistId: entry.watchlist.id,
        watchlistName: entry.watchlist.name,
        alert: {
            id: entry.alert.id,
            title: entry.alert.title,
            severity: entry.alert.severity,
            sourceFamily: entry.alert.sourceFamily,
            evidenceCount: entry.alert.evidenceCount,
            dedupeKey,
            casePath: entry.alert.casePath,
            caseId: entry.alert.caseId,
            alertUrl: entry.alert.alertUrl,
            provenanceSummary: entry.alert.provenanceSummary,
            watchlist: {
                id: entry.watchlist.id,
                name: entry.watchlist.name,
                terms: entry.watchlist.terms,
            },
            delivery: {
                route: entry.route,
                replay: entry.replay,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
            },
        },
    }
    const caseActionDryRunReceipt = buildDwmWebhookCaseActionDryRunReceipt({
        entry,
        retryBody,
        blockers: uniqueBlockers,
        canDryRunRetry,
        liveDeliveryEnabled,
    })
    const nextState = blockingCodes.includes('destination_unavailable')
        ? 'destination_unavailable'
        : blockingCodes.includes('destination_disabled')
            ? 'destination_disabled'
            : entry.dedupe.alreadyDelivered
                ? 'already_delivered'
                : entry.retry.terminalFailure
                    ? 'terminal_failure'
                    : canDryRunRetry
                        ? 'dry_run_retry_ready'
                        : entry.dryRun && entry.status !== 'failed'
                            ? 'dry_run_recorded'
                            : entry.status

    return {
        schemaVersion: 'dwm.webhook.delivery_transition_receipt.v1',
        org: receiptContext.org,
        destinationId: entry.destinationId,
        redactedTarget: {
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHint: entry.destination.redactedEndpoint.endpointHint,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: receiptContext.alert,
        case: {
            id: entry.alert.caseId,
            path: entry.alert.casePath,
            alertUrl: entry.alert.alertUrl,
        },
        watchlist: receiptContext.watchlist,
        provenance: receiptContext.provenance,
        workflow: {
            eventType: entry.eventType,
            status: entry.replay ? 'replayed' : entry.eventType.replace('dwm.alert.', ''),
            replay: entry.replay,
            dryRun: entry.dryRun,
            live: entry.live,
            route: entry.route,
            routeUrl: entry.alert.alertUrl || entry.alert.casePath || entry.route || null,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey,
        },
        audit: {
            auditEventId: entry.deliveryProof.auditEventId,
            auditAction: entry.deliveryProof.auditAction,
            auditEventIds: retryKey?.audit.auditEventIds || (entry.deliveryProof.auditEventId ? [entry.deliveryProof.auditEventId] : []),
        },
        state: {
            current: entry.status,
            rawStatus: entry.rawStatus,
            next: nextState,
            attemptedAt: entry.deliveryProof.attemptedAt,
            updatedAt: entry.deliveryProof.updatedAt,
        },
        retry: {
            retryable: entry.retry.retryable,
            attemptCount: retryKey?.retry.persistedAttemptCount || entry.retry.attemptCount,
            nextRetryAt: entry.retry.nextRetryAt,
            lastErrorCategory: entry.retry.lastErrorCategory,
            terminalFailure: entry.retry.terminalFailure,
            dryRunReady: canDryRunRetry,
            liveReady: canLiveRetry,
        },
        requests: {
            dryRunRetry: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: false,
                canSend: canDryRunRetry,
                blockers: canDryRunRetry ? [] : uniqueBlockers.filter(blocker => blocker.blocking),
                body: canDryRunRetry ? { ...retryBody, dryRun: true, live: false } : null,
                expectedAuditAction: entry.replay ? 'delivery.replayed' : 'delivery.retry_requested',
            },
            liveRetry: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: !liveDeliveryEnabled,
                externalSendEnabled: canLiveRetry,
                canSend: canLiveRetry,
                blockers: canLiveRetry ? [] : uniqueWebhookBlockers([
                    ...(!liveDeliveryEnabled ? [retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', entry.destinationId, true)] : []),
                    ...uniqueBlockers,
                ]).filter(blocker => blocker.blocking),
                body: canLiveRetry ? { ...retryBody, dryRun: false, live: true } : null,
                expectedAuditAction: entry.replay ? 'delivery.replayed' : 'delivery.retry_requested',
            },
        },
        caseActionDryRunReceipt,
        denial: {
            denied: blockingCodes.length > 0 || !access.canRetry && entry.retry.retryable,
            blockers: uniqueBlockers,
            blockingCodes,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
        },
    }
}
