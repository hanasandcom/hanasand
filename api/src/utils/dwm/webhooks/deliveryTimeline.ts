import type { buildDwmWebhookDeliveryReceipts } from './implementation/delivery-receipts.ts'
import { uniqueWebhookBlockers } from '../webhookValueUtils.ts'

type DeliveryReceipts = ReturnType<typeof buildDwmWebhookDeliveryReceipts>

export function buildDwmWebhookDeliveryTimelineFromReceipts(
    receipts: DeliveryReceipts,
    liveDeliveryEnabled: boolean,
) {
    const groups = new Map<string, typeof receipts.receipts>()
    for (const receipt of receipts.receipts) {
        const key = [
            receipt.orgId,
            receipt.alertId || receipt.dedupeKey || receipt.casePath || receipt.deliveryId,
            receipt.dedupeKey || receipt.casePath || receipt.alertId || receipt.deliveryId,
        ].join(':')
        const rows = groups.get(key) || []
        rows.push(receipt)
        groups.set(key, rows)
    }
    const timelines = [...groups.values()].map((rows) => {
        const sorted = [...rows].sort((a, b) => String(b.proof.attemptedAt || b.proof.createdAt).localeCompare(String(a.proof.attemptedAt || a.proof.createdAt)))
        const latest = sorted[0]
        const destinationIds = [...new Set(sorted.map(row => row.destinationId).filter(Boolean) as string[])]
        const auditEventIds = [...new Set(sorted.map(row => row.proof.auditEventId).filter(Boolean) as string[])]
        const blockers = uniqueWebhookBlockers(sorted.flatMap(row => row.blockers))
        const sentCount = sorted.filter(row => row.status === 'sent').length
        const failedCount = sorted.filter(row => row.status === 'failed').length
        const skippedCount = sorted.filter(row => row.status === 'skipped').length
        const retryableCount = sorted.filter(row => row.retry.retryable).length
        const terminalFailureCount = sorted.filter(row => row.retry.terminalFailure).length
        const status = sentCount > 0
            ? 'delivered'
            : retryableCount > 0
                ? 'retry_scheduled'
                : terminalFailureCount > 0
                    ? 'terminal_failure'
                    : failedCount > 0
                        ? 'failed'
                        : skippedCount === sorted.length
                            ? 'skipped'
                            : 'pending'

        return {
            schemaVersion: 'dwm.webhook.delivery_timeline_entry.v1',
            orgId: latest.orgId,
            alertId: latest.alertId,
            dedupeKey: latest.dedupeKey,
            casePath: latest.casePath,
            alertUrl: latest.alertUrl,
            route: latest.route,
            watchlist: latest.watchlist,
            status,
            latestDeliveryId: latest.deliveryId,
            latestRequestId: latest.requestId,
            latestAttemptedAt: latest.proof.attemptedAt,
            destinationIds,
            destinationCount: destinationIds.length,
            auditEventIds,
            latestAuditEventId: auditEventIds[0] || null,
            counts: {
                receipts: sorted.length,
                sent: sentCount,
                failed: failedCount,
                skipped: skippedCount,
                dryRun: sorted.filter(row => row.dryRun).length,
                live: sorted.filter(row => row.live).length,
                replay: sorted.filter(row => row.replay).length,
                retryable: retryableCount,
                terminalFailure: terminalFailureCount,
                blocked: sorted.filter(row => row.blockingCodes.length > 0).length,
            },
            retry: {
                nextRetryAt: sorted.find(row => row.retry.nextRetryAt)?.retry.nextRetryAt || null,
                lastErrorCategory: sorted.find(row => row.retry.lastErrorCategory)?.retry.lastErrorCategory || null,
                retryable: retryableCount > 0,
                terminalFailure: terminalFailureCount > 0,
            },
            latestReceipt: latest,
            operationLinks: latest.operationLinks,
            receipts: sorted.slice(0, 10),
            blockers,
            blockingCodes: blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code),
        }
    }).sort((a, b) => String(b.latestAttemptedAt).localeCompare(String(a.latestAttemptedAt)))

    return {
        schemaVersion: 'dwm.webhook.delivery_timeline.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: receipts.externalSendEnabled,
        visibility: receipts.visibility,
        access: receipts.access,
        filters: receipts.filters,
        counts: {
            timelines: timelines.length,
            receipts: receipts.counts.total,
            delivered: timelines.filter(item => item.status === 'delivered').length,
            retryScheduled: timelines.filter(item => item.status === 'retry_scheduled').length,
            terminalFailure: timelines.filter(item => item.status === 'terminal_failure').length,
            blocked: timelines.filter(item => item.blockingCodes.length > 0).length,
            auditLinked: timelines.filter(item => Boolean(item.latestAuditEventId)).length,
        },
        blockers: receipts.blockers,
        timelines,
    }
}
