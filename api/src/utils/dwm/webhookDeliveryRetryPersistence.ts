import type { DwmWebhookDestinationPublic, DwmWebhookDeliveryEvidenceFilters } from './webhooks.ts'
import { dedupeFromIdempotencyKey, idempotencyCoverage } from './webhookDeliveryUtilities.ts'
import { buildDwmWebhookDeliveryLedgerFromEvidence } from './webhookDeliveryLedger.ts'
import { buildDwmWebhookAuditEventContractsFromLedger } from './webhookAuditContracts.ts'
import { clean } from './webhookValueUtils.ts'
export function buildDwmWebhookDeliveryRetryPersistenceFromProjection({
    destinations, filters, liveDeliveryEnabled, ledger, auditContracts,
}: {
    destinations: DwmWebhookDestinationPublic[]
    filters: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled: boolean
    ledger: ReturnType<typeof buildDwmWebhookDeliveryLedgerFromEvidence>
    auditContracts: ReturnType<typeof buildDwmWebhookAuditEventContractsFromLedger>
}) {
    const auditsByDelivery = new Map<string, typeof auditContracts>()
    for (const audit of auditContracts) {
        if (!audit.deliveryId) continue
        const audits = auditsByDelivery.get(audit.deliveryId) || []
        audits.push(audit)
        auditsByDelivery.set(audit.deliveryId, audits)
    }
    const destinationsById = new Map(destinations.map(destination => [destination.id, destination]))
    const groups = new Map<string, typeof ledger>()
    for (const attempt of ledger) {
        const key = attempt.idempotencyKey || attempt.deliveryId
        const attempts = groups.get(key) || []
        attempts.push(attempt)
        groups.set(key, attempts)
    }

    const deliveryKeys = [...groups.entries()].map(([key, attempts]) => {
        const sortedAttempts = [...attempts]
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latest = sortedAttempts[0]
        const sent = sortedAttempts.find(attempt => attempt.status === 'sent') || null
        const destination = latest.destinationId ? destinationsById.get(latest.destinationId) || null : null
        const auditEventIds = [...new Set(sortedAttempts.flatMap((attempt) => {
            const audits = auditsByDelivery.get(attempt.deliveryId) || []
            return [
                attempt.auditEventId,
                ...audits.map(audit => audit.auditEventId),
            ].filter(Boolean) as string[]
        }))]
        const terminalFailure = !sent
            && (latest.status === 'failed' || latest.status === 'skipped')
            && !latest.retryable
            && latest.errorClass !== 'live_delivery_disabled'
        const retryable = !sent && latest.retryable
        const duplicateAttemptCount = sortedAttempts.length > 1 ? sortedAttempts.length : 0
        const retryBlockerCodes = [
            destination && destination.status !== 'active' ? 'destination_disabled' : null,
            !latest.redactedDestination.endpointHash && !latest.redactedDestination.endpointHint ? 'missing_webhook_url' : null,
            !liveDeliveryEnabled ? 'live_delivery_disabled' : null,
            sent ? 'dedupe_already_delivered' : null,
            terminalFailure ? 'terminal_failure' : null,
            !retryable && !sent && !terminalFailure ? 'retry_not_eligible' : null,
            auditEventIds.length === 0 ? 'audit_missing' : null,
        ].filter(Boolean) as string[]
        const retryNextAction = sent
            ? 'delivery.retry_skipped_duplicate'
            : terminalFailure
                ? 'delivery.retry_terminal_failure'
                : retryable
                    ? 'delivery.retry_scheduled'
                    : 'delivery.retry_not_eligible'
        const retryCustomerAction = sent
            ? 'View delivered attempt before replaying.'
            : terminalFailure
                ? 'Fix the destination or payload issue before retrying.'
                : retryable
                    ? 'Run a dry-run retry and confirm the payload before enabling live delivery.'
                    : 'Review delivery evidence before retrying.'

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_key.v1',
            idempotencyKey: latest.idempotencyKey || key,
            dedupeKey: latest.dedupeKey || dedupeFromIdempotencyKey(latest.idempotencyKey) || null,
            orgId: latest.orgId,
            destinationId: latest.destinationId,
            alertId: latest.alertId,
            eventType: latest.eventType,
            watchlistId: latest.watchlistId,
            watchlistName: latest.watchlistName,
            route: latest.route,
            casePath: latest.casePath,
            replay: sortedAttempts.some(attempt => attempt.replay),
            status: sent ? 'delivered' : retryable ? 'retry_scheduled' : terminalFailure ? 'terminal_failure' : latest.status,
            destination: {
                id: latest.destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                status: destination?.status || null,
                enabled: destination ? destination.status === 'active' : null,
                redactedEndpoint: latest.redactedDestination,
            },
            retry: {
                persistedAttemptCount: sortedAttempts.length,
                attemptCount: latest.attemptCount,
                retryable,
                nextRetryAt: retryable ? latest.nextRetryAt : null,
                lastErrorCategory: latest.errorClass,
                reason: latest.retryReason,
                terminalFailure,
                backoffPersisted: retryable && Boolean(latest.nextRetryAt),
                nextAuditAction: retryNextAction,
                nextCustomerAction: retryCustomerAction,
                blockerCodes: retryBlockerCodes,
            },
            dedupe: {
                alreadyDelivered: Boolean(sent),
                duplicate: duplicateAttemptCount > 0,
                duplicateAttemptCount,
                latestDedupeKey: latest.dedupeKey || dedupeFromIdempotencyKey(latest.idempotencyKey) || null,
            },
            latestAttempt: {
                requestId: latest.requestId,
                deliveryId: latest.deliveryId,
                status: latest.status,
                rawStatus: latest.rawStatus,
                dryRun: latest.dryRun,
                live: latest.live,
                liveRequested: latest.liveRequested,
                responseStatus: latest.responseStatus,
                errorClass: latest.errorClass,
                attemptedAt: latest.attemptedAt,
                auditEventId: latest.auditEventId,
            },
            attempts: sortedAttempts.slice(0, 5).map(attempt => ({
                requestId: attempt.requestId,
                deliveryId: attempt.deliveryId,
                status: attempt.status,
                rawStatus: attempt.rawStatus,
                dryRun: attempt.dryRun,
                live: attempt.live,
                liveRequested: attempt.liveRequested,
                retryable: attempt.retryable,
                nextRetryAt: attempt.nextRetryAt,
                errorClass: attempt.errorClass,
                responseStatus: attempt.responseStatus,
                auditEventId: attempt.auditEventId,
                attemptedAt: attempt.attemptedAt,
            })),
            audit: {
                latestAuditEventId: auditEventIds[0] || null,
                auditEventIds,
            },
            persistence: {
                rowKey: latest.idempotencyKey || key,
                primaryDeliveryId: latest.deliveryId,
                persistedDeliveryIds: sortedAttempts.map(attempt => attempt.deliveryId),
                persistedRequestIds: sortedAttempts.map(attempt => attempt.requestId),
                createdAt: sortedAttempts[sortedAttempts.length - 1]?.createdAt || null,
                updatedAt: latest.attemptedAt || latest.createdAt,
                latestStatus: latest.status,
                latestResponseStatus: latest.responseStatus,
                latestErrorCategory: latest.errorClass,
                auditEventIds,
                retryBackoffPersisted: retryable && Boolean(latest.nextRetryAt),
                nextRetryAt: retryable ? latest.nextRetryAt : null,
                nextAuditAction: retryNextAction,
                blockerCodes: retryBlockerCodes,
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    responseBodyExposed: false,
                    webhookSecretExposed: false,
                },
            },
        }
    }).sort((a, b) => String(b.latestAttempt.attemptedAt).localeCompare(String(a.latestAttempt.attemptedAt)))

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_persistence.v1',
        liveDeliveryEnabled,
        filters: {
            orgId: clean(filters.orgId) || null,
            destinationId: clean(filters.destinationId) || null,
            alertId: clean(filters.alertId) || null,
            casePath: clean(filters.casePath) || null,
            dedupeKey: clean(filters.dedupeKey) || null,
            requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
        },
        totalDeliveryKeys: deliveryKeys.length,
        counts: {
            attempts: ledger.length,
            retryable: deliveryKeys.filter(item => item.retry.retryable).length,
            terminalFailure: deliveryKeys.filter(item => item.retry.terminalFailure).length,
            delivered: deliveryKeys.filter(item => item.dedupe.alreadyDelivered).length,
            dryRun: deliveryKeys.filter(item => item.latestAttempt.dryRun).length,
            live: deliveryKeys.filter(item => item.latestAttempt.live).length,
            replay: deliveryKeys.filter(item => item.replay).length,
            duplicateDedupe: deliveryKeys.filter(item => item.dedupe.duplicate).length,
        },
        idempotencyCoverage: idempotencyCoverage(ledger),
        deliveryKeys,
    }
}
