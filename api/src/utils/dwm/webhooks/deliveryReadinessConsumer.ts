import type { buildDwmWebhookDeliveryHistoryConsumerProof } from '../webhooks.ts'
import { makeWebhookBlocker, uniqueWebhookBlockers } from '../webhookValueUtils.ts'

type DeliveryHistory = ReturnType<typeof buildDwmWebhookDeliveryHistoryConsumerProof>

export function buildDwmWebhookDeliveryReadinessConsumerProjection<Access extends { canRetry: boolean }, Visibility>(
    history: DeliveryHistory,
    decision: Visibility,
    access: Access,
    liveDeliveryEnabled: boolean,
) {
    const rows = history.rows.map((row) => {
        const retryableFailure = Boolean(row.retry.nextRetryAt) && !row.retry.terminalFailure && !row.idempotency.alreadyDelivered
        const nonRetryableFailure = row.retry.terminalFailure || row.blockers.some(blocker => blocker.code === 'terminal_failure')
        const success = row.status === 'sent' || row.rawStatus === 'delivered'
        const idempotentReplay = row.replayHistory.duplicateReplay || row.idempotency.duplicate || row.idempotency.alreadyDelivered
        const redactedDryRun = row.dryRun && row.discord.safeForCustomerDisplay && row.redactedDestination.endpointExposed === false
        const state = nonRetryableFailure
            ? 'non_retryable_failure'
            : retryableFailure
                ? 'retryable_failure'
                : idempotentReplay
                    ? 'idempotent_replay'
                    : success
                        ? 'ready'
                        : 'blocked'
        const readinessBlockers = uniqueWebhookBlockers([
            ...row.blockers,
            ...(retryableFailure ? [makeWebhookBlocker('retry_scheduled', 'Delivery has a scheduled retry/backoff time.', row.destinationId, false)] : []),
            ...(nonRetryableFailure ? [makeWebhookBlocker('terminal_failure', 'Latest delivery failure is terminal and not eligible for retry.', row.destinationId, true)] : []),
            ...(!row.audit.linked ? [makeWebhookBlocker('audit_missing', 'Delivery readiness has no linked audit event yet.', row.destinationId, false)] : []),
            ...(!liveDeliveryEnabled && row.live ? [makeWebhookBlocker('live_delivery_disabled', 'Live webhook delivery is disabled; this row is a dry run until delivery is enabled.', row.destinationId, false)] : []),
        ])

        return {
            schemaVersion: 'dwm.webhook.delivery_readiness_consumer_row.v1',
            deliveryId: row.deliveryId,
            requestId: row.requestId,
            orgId: row.orgId,
            destinationId: row.destinationId,
            alertId: row.alertId,
            watchlistId: row.watchlistId,
            eventType: row.eventType,
            state,
            status: row.status,
            rawStatus: row.rawStatus,
            dryRun: row.dryRun,
            live: row.live,
            replay: row.replay,
            idempotencyKey: row.idempotencyKey,
            dedupeKey: row.dedupeKey,
            context: {
                alertTitle: row.alert.title,
                severity: row.alert.severity,
                sourceFamily: row.alert.sourceFamily,
                evidenceCount: row.alert.evidenceCount,
                casePath: row.alert.casePath,
                alertUrl: row.alert.alertUrl,
                route: row.routes.deliveryDetail,
            },
            destination: {
                label: row.redactedDestination.label,
                type: row.redactedDestination.type,
                status: row.redactedDestination.status,
                endpointHash: row.redactedDestination.endpointHash,
                endpointHint: row.redactedDestination.endpointHint,
                endpointExposed: false,
            },
            readiness: {
                success,
                retryableFailure,
                nonRetryableFailure,
                idempotentReplay,
                redactedDryRun,
                auditLinked: row.audit.linked,
                retryEligible: retryableFailure && access.canRetry,
                liveBlocked: !liveDeliveryEnabled && row.live,
                safeForCustomerDisplay: true,
            },
            retry: row.retry,
            audit: row.audit,
            replayHistory: row.replayHistory,
            idempotency: row.idempotency,
            blockers: readinessBlockers,
            operationLinks: row.routes,
            timestamps: row.timestamps,
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                responseBodyExposed: false,
                webhookSecretExposed: false,
                payloadSecretExposed: false,
            },
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_readiness_consumer.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: rows.some(row => row.live && !row.readiness.liveBlocked),
        visibility: decision,
        access,
        filters: history.filters,
        routeContract: {
            list: history.routeContract.list,
            detail: history.routeContract.detail,
            retryDryRun: history.routeContract.retryDryRun,
        },
        counts: {
            total: rows.length,
            success: rows.filter(row => row.readiness.success).length,
            retryableFailure: rows.filter(row => row.readiness.retryableFailure).length,
            nonRetryableFailure: rows.filter(row => row.readiness.nonRetryableFailure).length,
            idempotentReplay: rows.filter(row => row.readiness.idempotentReplay).length,
            redactedDryRun: rows.filter(row => row.readiness.redactedDryRun).length,
            crossOrgDenied: 0,
            auditLinked: rows.filter(row => row.readiness.auditLinked).length,
        },
        rows,
        blockers: rows.length
            ? uniqueWebhookBlockers(rows.flatMap(row => row.blockers))
            : [{
                code: 'no_delivery_history',
                message: 'No webhook delivery readiness rows matched the current filters.',
                blocking: false,
            }],
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            responseBodyExposed: false,
            webhookSecretExposed: false,
        },
    }
}
