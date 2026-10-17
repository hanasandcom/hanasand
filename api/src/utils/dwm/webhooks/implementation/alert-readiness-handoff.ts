import { DISCORD_CONTENT_LIMIT, DISCORD_EMBED_DESCRIPTION_LIMIT, DISCORD_EMBED_FIELD_LIMIT, DISCORD_EMBED_FIELD_NAME_LIMIT, DISCORD_EMBED_FIELD_VALUE_LIMIT, DISCORD_EMBED_TITLE_LIMIT } from '../discordPayloadLimits.ts'
import { buildDwmWebhookDispatchPlanForDestinations } from '../dispatchPlanning.ts'
import { buildDwmWebhookDeliveryRequestInput } from '../notificationInput.ts'
import { buildDwmAlertDeliveryPayload } from '../alertDeliveryPayload.ts'
import type { DwmAlertNotificationInput } from '../../webhookDestinationTypes.ts'
import { clean, recordOrEmpty, uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { parseBoolean, parseEventType } from '../../webhookDestinationInput.ts'
import { deliveryAuditActionForEvent } from '../../webhookAuditContracts.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic } from './webhook-contract-types.ts'
import { prepareDwmWebhookDestinationProjection, buildDwmWebhookDestinationHealthFromProjection } from './dwm-webhook-destination-projection.ts'
import { buildDwmWebhookDeliveryRetryPersistence } from './delivery-read-projections.ts'
import { alertReadinessBlocker } from './retry-queue-blocker.ts'
import { buildDwmAlertEventConsumer } from './alert-event-consumer.ts'

export function buildDwmAlertWebhookReadinessHandoff({
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
    const eventType = parseEventType(normalizedInput.eventType ?? normalizedInput.event_type, 'dwm.alert.created')
    const dispatch = buildDwmWebhookDispatchPlanForDestinations(ownerId, normalizedInput, destinations)
    const normalizedAlert = normalizeAlert(dispatch.alert)
    const watchlist = normalizeWatchlist(dispatch.alert.watchlist)
    const orgDestinations = destinations.filter(destination => destination.orgId === dispatch.orgId)
    const orgDeliveries = deliveries.filter(delivery => delivery.orgId === dispatch.orgId)
    const orgAuditEvents = auditEvents.filter(audit => audit.orgId === dispatch.orgId)
    const readinessProjection = prepareDwmWebhookDestinationProjection({
        destinations: orgDestinations,
        deliveries: orgDeliveries,
        auditEvents: orgAuditEvents,
        liveDeliveryEnabled,
    })
    const destinationReadiness = readinessProjection.readiness
    const destinationHealth = buildDwmWebhookDestinationHealthFromProjection({ ...readinessProjection, liveDeliveryEnabled })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistence({
        destinations: orgDestinations,
        deliveries: orgDeliveries,
        auditEvents: orgAuditEvents,
        liveDeliveryEnabled,
        filters: {
            orgId: dispatch.orgId,
            alertId: normalizedAlert.id,
            casePath: normalizedAlert.casePath,
            dedupeKey: normalizedAlert.dedupeKey || normalizedAlert.id,
        },
    })
    const selectedDestinationIds = new Set(dispatch.selectedDestinations.map(destination => destination.id))
    const selectedRetryKeys = retryPersistence.deliveryKeys
        .filter(key => key.destinationId && selectedDestinationIds.has(key.destinationId))
    const alertEventExpectedAuditAction = deliveryAuditActionForEvent(eventType)
    const alertEventAuditContracts = readinessProjection.auditContracts
    const selectedAlertEventAuditContracts = alertEventAuditContracts.filter((audit) => {
        const auditDestinationSelected = audit.destinationId ? selectedDestinationIds.has(audit.destinationId) : false
        const auditAlertMatches = audit.delivery?.alertId === normalizedAlert.id
        const auditDedupeMatches = Boolean(normalizedAlert.dedupeKey && audit.delivery?.idempotencyKey?.includes(normalizedAlert.dedupeKey))
        return audit.orgId === dispatch.orgId && (auditDestinationSelected || auditAlertMatches || auditDedupeMatches)
    })
    const firstSelectedDestination = dispatch.selectedDestinations[0] || null
    const alertEventPreviewPayload = firstSelectedDestination
        ? buildDwmAlertDeliveryPayload({
            destination: {
                id: firstSelectedDestination.id,
                kind: firstSelectedDestination.kind,
                name: firstSelectedDestination.name,
                org_id: dispatch.orgId,
            },
            eventType,
            deliveryId: '<dry_run_delivery_id>',
            alert: dispatch.alert,
        }) as Record<string, unknown>
        : null
    const alertEventPreviewContext = recordOrEmpty(alertEventPreviewPayload?._hanasand)
    const alertEventPreviewEmbeds = Array.isArray(alertEventPreviewPayload?.embeds)
        ? alertEventPreviewPayload.embeds as Array<Record<string, unknown>>
        : []
    const alertEventPreviewFields = Array.isArray(alertEventPreviewEmbeds[0]?.fields)
        ? (alertEventPreviewEmbeds[0]?.fields as Array<Record<string, unknown>>)
        : []
    const alertEventPreviewFieldNames = alertEventPreviewFields.map(field => clean(field.name)).filter(Boolean)
    const alertEventRequiredDiscordFields = ['Organization', 'Severity', 'Watchlist', 'Source family', 'Evidence count', 'Workflow', 'Dedupe key']
    const alertEventMissingDiscordFields = alertEventRequiredDiscordFields.filter(name => !alertEventPreviewFieldNames.includes(name))
    const alertEventDiscordLimits = {
        content: clean(alertEventPreviewPayload?.content).length <= DISCORD_CONTENT_LIMIT,
        embedCount: alertEventPreviewEmbeds.length <= 10,
        title: clean(alertEventPreviewEmbeds[0]?.title).length <= DISCORD_EMBED_TITLE_LIMIT,
        description: clean(alertEventPreviewEmbeds[0]?.description).length <= DISCORD_EMBED_DESCRIPTION_LIMIT,
        fields: alertEventPreviewFields.length <= DISCORD_EMBED_FIELD_LIMIT,
        fieldNames: alertEventPreviewFields.every(field => clean(field.name).length <= DISCORD_EMBED_FIELD_NAME_LIMIT),
        fieldValues: alertEventPreviewFields.every(field => clean(field.value).length <= DISCORD_EMBED_FIELD_VALUE_LIMIT),
    }
    const alertEventSerializedPreview = JSON.stringify(alertEventPreviewPayload || {})
    const alertEventDiscordTemplate = recordOrEmpty(alertEventPreviewContext.discordTemplate)
    const alertEventRedactionProof = {
        endpointExposed: false,
        webhookSecretExposed: false,
        responseBodyExposed: false,
        mentionsDisabled: Array.isArray(recordOrEmpty(alertEventPreviewPayload?.allowed_mentions).parse)
            && (recordOrEmpty(alertEventPreviewPayload?.allowed_mentions).parse as unknown[]).length === 0,
        noWebhookUrl: !/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/i.test(alertEventSerializedPreview),
    }
    const alertEventRedactionValid = !alertEventRedactionProof.endpointExposed
        && !alertEventRedactionProof.webhookSecretExposed
        && !alertEventRedactionProof.responseBodyExposed
        && alertEventRedactionProof.mentionsDisabled
        && alertEventRedactionProof.noWebhookUrl
    const blockers: Array<{
        code: string
        message: string
        destinationId: string | null
        blocking: boolean
    }> = []

    if (!dispatch.orgId) blockers.push(alertReadinessBlocker('missing_org', 'Organization context is required for customer webhook delivery.'))
    if (!normalizedAlert.id && !normalizedAlert.dedupeKey) blockers.push(alertReadinessBlocker('missing_alert_context', 'Alert id or dedupe key is required for customer webhook delivery.'))
    if (!watchlist.id && !watchlist.name && watchlist.terms.length === 0) blockers.push(alertReadinessBlocker('missing_watchlist_context', 'Watchlist identity or matched term is required for customer context.'))
    if (!normalizedAlert.sourceFamily || normalizedAlert.sourceFamily === 'dark_web' && !normalizedAlert.provenanceSummary) blockers.push(alertReadinessBlocker('missing_source_proof', 'Source family or provenance proof is required for customer delivery.'))
    if (normalizedAlert.evidenceCount <= 0) blockers.push(alertReadinessBlocker('missing_evidence', 'At least one evidence item is required for customer delivery.'))
    if (!normalizedAlert.eventTimestamp) blockers.push(alertReadinessBlocker('missing_timestamp', 'A source observation timestamp is required for customer delivery.'))
    if (dispatch.selectedDestinations.length === 0) blockers.push(alertReadinessBlocker('no_enabled_destination', 'No enabled destination is selected for this org alert.'))
    for (const skipped of dispatch.skippedDestinations) {
        if (skipped.reason === 'disabled') blockers.push(alertReadinessBlocker('destination_disabled', 'A destination exists but is disabled for this alert event.', skipped.id))
        if (skipped.reason === 'event_not_subscribed') blockers.push(alertReadinessBlocker('event_not_subscribed', 'A destination is not subscribed to this alert event.', skipped.id, false))
    }
    if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(alertReadinessBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.'))
    for (const key of selectedRetryKeys) {
        if (key.dedupe.alreadyDelivered) blockers.push(alertReadinessBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the alert idempotency key.', key.destinationId, false))
        if (key.retry.retryable) blockers.push(alertReadinessBlocker('retry_scheduled', 'The latest failed delivery has retry/backoff scheduled.', key.destinationId, false))
        if (key.retry.terminalFailure) blockers.push(alertReadinessBlocker('terminal_failure', 'The latest delivery failed with a non-retryable error.', key.destinationId))
    }
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const ready = dispatch.selectedDestinations.length > 0 && blockingCodes.length === 0

    return {
        schemaVersion: 'dwm.webhook.alert_readiness_handoff.v1',
        ownerId,
        orgId: dispatch.orgId || null,
        tenantId: clean(normalizedInput.tenantId) || dispatch.orgId || null,
        alertId: normalizedAlert.id,
        eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        ready,
        state: ready ? 'ready' : dispatch.selectedDestinations.length > 0 ? 'blocked' : 'missing_destination',
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            caseId: normalizedAlert.caseId,
            alertUrl: normalizedAlert.alertUrl,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        destinationSelection: {
            selectedDestinationIds: dispatch.selectedDestinations.map(destination => destination.id),
            skippedDestinations: dispatch.skippedDestinations,
        },
        blockers: uniqueBlockers,
        blockerCodes: blockingCodes,
        destinationReadiness,
        destinationHealth,
        deliveryRetryPersistence: retryPersistence,
        alertEventConsumer: buildDwmAlertEventConsumer({
            dispatch, eventType, dryRun, normalizedAlert, watchlist, firstSelectedDestination,
            selectedAlertEventAuditContracts, alertEventExpectedAuditAction, alertEventPreviewPayload,
            alertEventPreviewEmbeds, alertEventPreviewFieldNames, alertEventRequiredDiscordFields,
            alertEventMissingDiscordFields, alertEventDiscordLimits, alertEventDiscordTemplate,
            alertEventRedactionProof, alertEventRedactionValid, ready, uniqueBlockers, blockingCodes,
        }),
    }
}
