import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { dedupeFromIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { normalizeWebhookEvidenceFilters } from '../../webhookDeliveryEvidence.ts'
import { type DwmWebhookDeliveryEvidenceAccessOptions } from './webhook-contract-types.ts'
import { deliveryEvidenceAccessDefaults } from './delivery-evidence-defaults.ts'
import { webhookVisibilityDecision, webhookAccess } from './webhook-visibility-decision.ts'
import { retryQueueBlocker } from './retry-queue-blocker.ts'
import { buildDwmWebhookDeliveryRetryPersistence } from './delivery-read-projections.ts'
import { buildDwmWebhookDeliveryReceipts } from './delivery-receipts.ts'

export function buildDwmWebhookDeliveryReplayGuard(options: DwmWebhookDeliveryEvidenceAccessOptions) {
    const { deliveries, auditEvents, destinations, filters, liveDeliveryEnabled, viewerRole, canManage, visibility } = deliveryEvidenceAccessDefaults(options)
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canManage', 'canReplay'] as const)
    const normalizedFilters = normalizeWebhookEvidenceFilters(filters)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_replay_guard.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                replayKeys: 0,
                dryRunAllowed: 0,
                liveBlocked: 0,
                duplicateDelivered: 0,
                retryable: 0,
                terminalFailure: 0,
            },
            blockers: [retryQueueBlocker('permission_denied', 'Webhook delivery replay guard is not visible for this organization membership.', normalizedFilters.destinationId, true)],
            entries: [],
        }
    }

    const persistence = buildDwmWebhookDeliveryRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const receiptByIdempotencyKey = new Map<string, typeof receipts.receipts[number]>()
    for (const receipt of receipts.receipts) {
        if (!receipt.idempotencyKey) continue
        const current = receiptByIdempotencyKey.get(receipt.idempotencyKey)
        if (!current || String(receipt.proof.attemptedAt || receipt.proof.createdAt).localeCompare(String(current.proof.attemptedAt || current.proof.createdAt)) > 0) {
            receiptByIdempotencyKey.set(receipt.idempotencyKey, receipt)
        }
    }

    const entries = persistence.deliveryKeys
        .map((key) => {
            const latestReceipt = receiptByIdempotencyKey.get(key.idempotencyKey) || null
            const blockers = []
            if (!access.canReplay) blockers.push(retryQueueBlocker('permission_denied', 'Only organization owners and admins can replay webhook deliveries.', key.destinationId, true))
            if (key.destination.status && key.destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled and cannot receive replay deliveries.', key.destinationId, true))
            const alreadyDelivered = key.dedupe.alreadyDelivered || key.status === 'delivered'
            if (alreadyDelivered) blockers.push(retryQueueBlocker('dedupe_already_delivered', 'A live delivery already exists for this destination and idempotency key.', key.destinationId, true))
            if (key.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and should be remediated before replay.', key.destinationId, true))
            if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; replay proof is dry-run only.', key.destinationId, false))
            if (!key.audit.latestAuditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Replay guard has no linked audit event yet.', key.destinationId, false))
            const uniqueBlockers = uniqueWebhookBlockers(blockers)
            const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
            const dryRunAllowed = access.canReplay && !blockingCodes.includes('permission_denied')
            const liveAllowed = dryRunAllowed && liveDeliveryEnabled && !alreadyDelivered && !key.retry.terminalFailure && blockingCodes.length === 0

            return {
                schemaVersion: 'dwm.webhook.delivery_replay_guard_entry.v1',
                idempotencyKey: key.idempotencyKey,
                orgId: key.orgId,
                destinationId: key.destinationId,
                alertId: key.alertId,
                eventType: key.eventType,
                dedupeKey: key.dedupe.latestDedupeKey || key.dedupeKey || dedupeFromIdempotencyKey(key.idempotencyKey) || null,
                watchlistId: key.watchlistId,
                watchlistName: key.watchlistName,
                route: key.route,
                casePath: key.casePath,
                replay: key.replay,
                status: key.status,
                destination: key.destination,
                guard: {
                    dryRunAllowed,
                    liveAllowed,
                    liveBlocked: !liveAllowed,
                    duplicateLiveBlocked: alreadyDelivered,
                    duplicateDryRunAllowed: dryRunAllowed,
                    noNetworkDefault: true,
                    externalSendEnabled: liveAllowed,
                },
                dedupe: key.dedupe,
                retry: key.retry,
                latestAttempt: key.latestAttempt,
                latestReceipt,
                audit: key.audit,
                blockers: uniqueBlockers,
                blockingCodes,
            }
        })

    return {
        schemaVersion: 'dwm.webhook.delivery_replay_guard.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.guard.externalSendEnabled),
        visibility: decision,
        access,
        filters: persistence.filters,
        counts: {
            total: entries.length,
            replayKeys: entries.filter(entry => entry.replay || entry.eventType === 'dwm.alert.replayed').length,
            dryRunAllowed: entries.filter(entry => entry.guard.dryRunAllowed).length,
            liveBlocked: entries.filter(entry => entry.guard.liveBlocked).length,
            duplicateDelivered: entries.filter(entry => entry.guard.duplicateLiveBlocked).length,
            retryable: entries.filter(entry => entry.retry.retryable).length,
            terminalFailure: entries.filter(entry => entry.retry.terminalFailure).length,
        },
        blockers: uniqueWebhookBlockers(entries.flatMap(entry => entry.blockers)),
        entries,
    }
}
