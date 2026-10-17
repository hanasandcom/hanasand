import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { normalizeWebhookEvidenceFilters } from '../../webhookDeliveryEvidence.ts'
import { type DwmWebhookDeliveryEvidenceAccessOptions } from './webhook-contract-types.ts'
import { webhookDeliveryVisibilityAccess } from './webhook-visibility-decision.ts'
import { retryQueueBlocker } from './retry-queue-blocker.ts'
import { buildDwmWebhookReceiptHistoryFilters } from './receipt-history-filters.ts'
import { buildDwmWebhookDeliveryHistoryWithRetryPersistence } from './delivery-history-with-retry-persistence.ts'
import { buildDwmWebhookDeliveryTransitionReceipt } from './delivery-transition-receipt.ts'

export function buildDwmWebhookDeliveryReceipts({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const { decision, access } = webhookDeliveryVisibilityAccess(visibility, viewerRole, canManage)
    const normalizedFilters = normalizeWebhookEvidenceFilters(filters)
    const permissionBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery receipts are not visible for this organization membership.', normalizedFilters.destinationId, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_receipts.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                sent: 0,
                failed: 0,
                skipped: 0,
                dryRun: 0,
                live: 0,
                replay: 0,
                retryable: 0,
                auditLinked: 0,
                blocked: 1,
            },
            blockers: [permissionBlocker],
            historyReplayFilters: buildDwmWebhookReceiptHistoryFilters({
                receipts: [],
                filters: normalizedFilters,
                access,
                liveDeliveryEnabled,
                blockers: [permissionBlocker],
            }),
            receipts: [],
        }
    }

    const { history, retryPersistence } = buildDwmWebhookDeliveryHistoryWithRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        now: new Date(),
    })
    const retryByIdempotencyKey = new Map(retryPersistence.deliveryKeys.map(key => [key.idempotencyKey, key]))
    const receipts = history.entries.map((entry) => {
        const retryKey = entry.deliveryProof.idempotencyKey
            ? retryByIdempotencyKey.get(entry.deliveryProof.idempotencyKey) || null
            : null
        const destinationUnavailable = !entry.destinationId
        const blockers = []
        if (entry.destinationId && entry.destination.status && entry.destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled.', entry.destinationId, true))
        if (destinationUnavailable) blockers.push(retryQueueBlocker('destination_unavailable', entry.destination.availability.message, null, true))
        if (entry.liveRequested && !liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', entry.destinationId, false))
        if (entry.status === 'skipped') blockers.push(retryQueueBlocker('delivery_skipped', 'Delivery attempt was skipped before external send.', entry.destinationId, true))
        if (entry.dedupe.alreadyDelivered && entry.status === 'skipped') blockers.push(retryQueueBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the idempotency key.', entry.destinationId, true))
        if (entry.retry.retryable) blockers.push(retryQueueBlocker('retry_scheduled', 'Delivery is retryable and has retry/backoff metadata.', entry.destinationId, false))
        if (!destinationUnavailable && entry.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and not eligible for retry.', entry.destinationId, true))
        if (!entry.deliveryProof.auditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Delivery receipt has no linked audit event yet.', entry.destinationId, false))
        const uniqueBlockers = uniqueWebhookBlockers(blockers)
        const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)

        return {
            schemaVersion: 'dwm.webhook.delivery_receipt.v1',
            requestId: entry.requestId,
            deliveryId: entry.deliveryId,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alert.id,
            eventType: entry.eventType,
            status: entry.status,
            rawStatus: entry.rawStatus,
            dryRun: entry.dryRun,
            live: entry.live,
            liveRequested: entry.liveRequested,
            replay: entry.replay,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey: entry.alert.dedupeKey,
            route: retryKey?.route || null,
            casePath: entry.alert.casePath,
            caseActionId: entry.alert.caseActionId,
            caseActionPath: entry.alert.caseActionPath,
            alertUrl: entry.alert.alertUrl,
            watchlist: entry.watchlist,
            destination: entry.destination,
            proof: {
                payloadHash: entry.deliveryProof.payloadHash,
                auditEventId: entry.deliveryProof.auditEventId,
                auditAction: entry.deliveryProof.auditAction,
                attemptedAt: entry.deliveryProof.attemptedAt,
                createdAt: entry.deliveryProof.createdAt,
                updatedAt: entry.deliveryProof.updatedAt,
                response: entry.deliveryProof.response,
                error: entry.deliveryProof.error,
                noNetwork: entry.dryRun || !entry.live,
                externalSendEnabled: entry.live && liveDeliveryEnabled,
            },
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: retryKey?.retry.persistedAttemptCount || entry.retry.attemptCount,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: destinationUnavailable ? false : entry.retry.terminalFailure,
            },
            dedupe: {
                alreadyDelivered: entry.dedupe.alreadyDelivered,
                duplicateAttemptCount: entry.dedupe.duplicateAttemptCount,
                latestDedupeKey: retryKey?.dedupe.latestDedupeKey || entry.alert.dedupeKey,
            },
            discordPreview: entry.discordPreview,
            sanitizedPayloadPreview: entry.sanitizedPayloadPreview,
            operationLinks: entry.operationLinks,
            blockers: uniqueBlockers,
            blockingCodes,
            transitionReceipt: buildDwmWebhookDeliveryTransitionReceipt({
                entry,
                retryKey,
                blockers: uniqueBlockers,
                access,
                liveDeliveryEnabled,
            }),
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_receipts.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: receipts.some(receipt => receipt.proof.externalSendEnabled),
        visibility: decision,
        access,
        filters: history.filters,
        counts: {
            total: receipts.length,
            sent: receipts.filter(receipt => receipt.status === 'sent').length,
            failed: receipts.filter(receipt => receipt.status === 'failed').length,
            skipped: receipts.filter(receipt => receipt.status === 'skipped').length,
            dryRun: receipts.filter(receipt => receipt.dryRun).length,
            live: receipts.filter(receipt => receipt.live).length,
            replay: receipts.filter(receipt => receipt.replay).length,
            retryable: receipts.filter(receipt => receipt.retry.retryable).length,
            auditLinked: receipts.filter(receipt => Boolean(receipt.proof.auditEventId)).length,
            blocked: receipts.filter(receipt => receipt.blockingCodes.length > 0).length,
        },
        blockers: uniqueWebhookBlockers(receipts.flatMap(receipt => receipt.blockers)),
        historyReplayFilters: buildDwmWebhookReceiptHistoryFilters({
            receipts,
            filters: history.filters,
            access,
            liveDeliveryEnabled,
            blockers: uniqueWebhookBlockers(receipts.flatMap(receipt => receipt.blockers)),
        }),
        receipts,
    }
}
