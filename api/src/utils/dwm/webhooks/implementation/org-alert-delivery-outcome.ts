import { buildDwmWebhookDispatchPlanForDestinations } from '../dispatchPlanning.ts'
import { buildDwmWebhookDeliveryRequestInput } from '../notificationInput.ts'
import { buildDwmWebhookDeliveryPreview } from '../deliveryPreview.ts'
import type { DwmAlertNotificationInput } from '../../webhookDestinationTypes.ts'
import { clean, uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { parseBoolean } from '../../webhookDestinationInput.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic } from './webhook-contract-types.ts'
import { prepareDwmWebhookDestinationProjection, buildDwmWebhookDestinationHealthFromProjection } from './dwm-webhook-destination-projection.ts'
import { orgAlertOutcomeBlocker } from './retry-queue-blocker.ts'

export function buildDwmOrgAlertWebhookDeliveryOutcome({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const dispatch = buildDwmWebhookDispatchPlanForDestinations(ownerId, normalizedInput, destinations)
    const normalizedAlert = normalizeAlert(dispatch.alert)
    const watchlist = normalizeWatchlist(dispatch.alert.watchlist)
    const outcomeProjection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const { deliveryLedger: ledger, auditContracts } = outcomeProjection
    const deliveryById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const auditByDeliveryId = new Map(auditContracts.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const healthRows = buildDwmWebhookDestinationHealthFromProjection({ ...outcomeProjection, liveDeliveryEnabled })
    const healthByDestination = new Map(healthRows.map(health => [health.destinationId, health]))

    const selectedDestinations = dispatch.selectedDestinations.map((destination) => {
        const idempotencyKey = buildIdempotencyKey(dispatch.eventType, dispatch.orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
        const relatedAttempts = ledger
            .filter(attempt => attempt.idempotencyKey === idempotencyKey)
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestAttempt = relatedAttempts[0] || null
        const delivery = latestAttempt ? deliveryById.get(latestAttempt.deliveryId) || null : null
        const preview = delivery ? buildDwmWebhookDeliveryPreview(delivery) : null
        const audit = latestAttempt ? auditByDeliveryId.get(latestAttempt.deliveryId) || null : null
        const health = healthByDestination.get(destination.id) || null
        const blockers: ReturnType<typeof orgAlertOutcomeBlocker>[] = []
        if (!latestAttempt) blockers.push(orgAlertOutcomeBlocker('not_recorded', 'No delivery attempt has been recorded for this selected destination yet.', destination.id, true))
        if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(orgAlertOutcomeBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', destination.id, true))
        if (latestAttempt?.retryable) blockers.push(orgAlertOutcomeBlocker('retry_scheduled', 'Latest delivery attempt is retryable and has backoff scheduled.', destination.id, false))
        if (latestAttempt?.status === 'skipped') blockers.push(orgAlertOutcomeBlocker('delivery_skipped', 'Latest delivery attempt was skipped.', destination.id, latestAttempt.errorClass !== 'live_delivery_disabled'))
        if (health && !health.ready && health.blockers.some(blocker => blocker !== 'live_delivery_disabled' && blocker !== 'retry_scheduled')) {
            blockers.push(orgAlertOutcomeBlocker('destination_unhealthy', 'Destination health is not ready for customer delivery.', destination.id, Boolean(health.retry.retryable)))
        }

        return {
            schemaVersion: 'dwm.webhook.org_alert_delivery_outcome_destination.v1',
            destinationId: destination.id,
            orgId: destination.org_id,
            label: destination.name,
            type: destination.kind,
            status: latestAttempt?.status || 'not_recorded',
            idempotencyKey,
            recorded: Boolean(latestAttempt),
            latestAttempt: latestAttempt
                ? {
                    requestId: latestAttempt.requestId,
                    deliveryId: latestAttempt.deliveryId,
                    status: latestAttempt.status,
                    rawStatus: latestAttempt.rawStatus,
                    dryRun: latestAttempt.dryRun,
                    live: latestAttempt.live,
                    liveRequested: latestAttempt.liveRequested,
                    responseStatus: latestAttempt.responseStatus,
                    errorClass: latestAttempt.errorClass,
                    retryable: latestAttempt.retryable,
                    nextRetryAt: latestAttempt.nextRetryAt,
                    attemptCount: latestAttempt.attemptCount,
                    auditEventId: audit?.auditEventId || latestAttempt.auditEventId,
                    attemptedAt: latestAttempt.attemptedAt,
                    payloadHash: latestAttempt.payloadHash,
                }
                : null,
            preview: preview
                ? {
                    discord: {
                        content: preview.discord.content,
                        embedCount: Array.isArray(preview.discord.embeds) ? preview.discord.embeds.length : 0,
                        fieldNames: Array.isArray((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields)
                            ? (((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields || []) as Array<Record<string, unknown>>).map(field => clean(field.name)).filter(Boolean)
                            : [],
                    },
                    context: preview.context,
                    payloadHash: preview.payloadHash,
                }
                : null,
            audit: {
                latestAuditEventId: audit?.auditEventId || latestAttempt?.auditEventId || null,
                action: audit?.action || latestAttempt?.auditAction || null,
            },
            operationLinks: preview?.operationLinks || null,
            health: health
                ? {
                    status: health.health,
                    ready: health.ready,
                    blockers: health.blockers,
                    latestAuditEventId: health.latestAuditEventId,
                }
                : null,
            blockers: uniqueWebhookBlockers(blockers),
        }
    })
    const skippedDestinations = dispatch.skippedDestinations.map(skipped => ({
        schemaVersion: 'dwm.webhook.org_alert_delivery_outcome_skipped_destination.v1',
        destinationId: skipped.id,
        orgId: skipped.orgId,
        status: 'skipped',
        reason: skipped.reason,
        blockers: [orgAlertOutcomeBlocker(skipped.reason, `Destination skipped: ${skipped.reason}.`, skipped.id, skipped.reason !== 'event_not_subscribed')],
    }))
    const allBlockers = uniqueWebhookBlockers([
        ...selectedDestinations.flatMap(destination => destination.blockers),
        ...skippedDestinations.flatMap(destination => destination.blockers),
    ])

    return {
        schemaVersion: 'dwm.webhook.org_alert_delivery_outcome.v1',
        ownerId,
        orgId: dispatch.orgId || null,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            alertUrl: normalizedAlert.alertUrl,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        counts: {
            selected: selectedDestinations.length,
            skipped: skippedDestinations.length,
            recorded: selectedDestinations.filter(destination => destination.recorded).length,
            dryRun: selectedDestinations.filter(destination => destination.latestAttempt?.dryRun).length,
            delivered: selectedDestinations.filter(destination => destination.latestAttempt?.status === 'sent').length,
            failed: selectedDestinations.filter(destination => destination.latestAttempt?.status === 'failed').length,
            retryable: selectedDestinations.filter(destination => destination.latestAttempt?.retryable).length,
            blocked: allBlockers.filter(blocker => blocker.blocking).length,
        },
        selectedDestinations,
        skippedDestinations,
        blockers: allBlockers,
    }
}
