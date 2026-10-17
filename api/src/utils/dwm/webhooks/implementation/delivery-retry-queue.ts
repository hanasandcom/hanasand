import { clean, uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { type DwmWebhookDestinationDeliveryAccessOptions } from './webhook-contract-types.ts'
import { webhookDeliveryVisibilityAccess } from './webhook-visibility-decision.ts'
import { retryQueueBlocker } from './retry-queue-blocker.ts'
import { buildDwmWebhookDeliveryRetryPersistence } from './delivery-read-projections.ts'
import { buildDwmWebhookDestinationHealth } from './destination-health.ts'

export function buildDwmWebhookDeliveryRetryQueue({
    destinations,
    deliveries = [],
    auditEvents = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationDeliveryAccessOptions) {
    const { decision, access } = webhookDeliveryVisibilityAccess(visibility, viewerRole, canManage)
    const deniedBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery retry queue is not visible for this organization membership.', null, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_retry_queue.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: {
                orgId: clean(filters.orgId) || null,
                destinationId: clean(filters.destinationId) || null,
                alertId: clean(filters.alertId) || null,
                casePath: clean(filters.casePath) || null,
                dedupeKey: clean(filters.dedupeKey) || null,
                requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
            },
            counts: {
                total: 0,
                retryable: 0,
                dryRunReady: 0,
                liveReady: 0,
                blocked: 0,
                delivered: 0,
                terminalFailure: 0,
                auditLinked: 0,
            },
            blockers: [deniedBlocker],
            entries: [],
        }
    }

    const persistence = buildDwmWebhookDeliveryRetryPersistence({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
    })
    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const healthByDestination = new Map(healthRows.map(health => [health.destinationId, health]))
    const destinationsById = new Map(destinations.map(destination => [destination.id, destination]))
    const entries = persistence.deliveryKeys.map((key) => {
        const destinationId = key.destinationId || null
        const destination = destinationId ? destinationsById.get(destinationId) || null : null
        const health = destinationId ? healthByDestination.get(destinationId) || null : null
        const blockers = []
        if (!access.canRetry) blockers.push(retryQueueBlocker('permission_denied', 'Only organization owners and admins can retry webhook deliveries.', key.destinationId, true))
        if (destination && destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled and cannot be retried.', key.destinationId, true))
        if (!key.destination.redactedEndpoint.endpointHash && !key.destination.redactedEndpoint.endpointHint) blockers.push(retryQueueBlocker('missing_webhook_url', 'Destination has no configured webhook URL reference.', key.destinationId, true))
        if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; dry-run retry proof is still available.', key.destinationId, false))
        if (key.dedupe.alreadyDelivered) blockers.push(retryQueueBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the idempotency key.', key.destinationId, true))
        if (key.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and not eligible for retry.', key.destinationId, true))
        if (!key.retry.retryable && !key.dedupe.alreadyDelivered && !key.retry.terminalFailure) blockers.push(retryQueueBlocker('retry_not_eligible', 'Latest delivery attempt is not eligible for retry.', key.destinationId, true))
        if (!key.audit.latestAuditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Retry queue entry has no linked audit event yet.', key.destinationId, false))
        const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
        const dryRunReady = access.canRetry && key.retry.retryable && blockingCodes.length === 0
        const liveReady = dryRunReady && liveDeliveryEnabled

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_queue_entry.v1',
            idempotencyKey: key.idempotencyKey,
            orgId: key.orgId,
            destinationId: key.destinationId,
            alertId: key.alertId,
            eventType: key.eventType,
            watchlistId: key.watchlistId,
            watchlistName: key.watchlistName,
            route: key.route,
            casePath: key.casePath,
            replay: key.replay,
            status: key.status,
            destination: key.destination,
            health: {
                status: health?.health || null,
                ready: health?.ready || false,
                blockers: health?.blockers || [],
                latestAuditEventId: health?.latestAuditEventId || null,
            },
            retry: {
                ...key.retry,
                dryRunReady,
                liveReady,
                mode: liveReady ? 'live' : dryRunReady ? 'dry_run' : 'blocked',
            },
            dedupe: key.dedupe,
            latestAttempt: key.latestAttempt,
            attempts: key.attempts,
            audit: key.audit,
            blockers: uniqueWebhookBlockers(blockers),
            blockingCodes,
            noNetwork: true,
            externalSendEnabled: liveReady,
        }
    })
    const blockers = uniqueWebhookBlockers(entries.flatMap(entry => entry.blockers))

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_queue.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.externalSendEnabled),
        visibility: decision,
        access,
        filters: persistence.filters,
        counts: {
            total: entries.length,
            retryable: entries.filter(entry => entry.retry.retryable).length,
            dryRunReady: entries.filter(entry => entry.retry.dryRunReady).length,
            liveReady: entries.filter(entry => entry.retry.liveReady).length,
            blocked: entries.filter(entry => entry.blockingCodes.length > 0).length,
            delivered: entries.filter(entry => entry.dedupe.alreadyDelivered).length,
            terminalFailure: entries.filter(entry => entry.retry.terminalFailure).length,
            auditLinked: entries.filter(entry => Boolean(entry.audit.latestAuditEventId)).length,
        },
        blockers,
        entries,
    }
}
