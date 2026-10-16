import type { DwmAlertNotificationInput } from '../webhookDestinationTypes.ts'
import type { DwmAlertWebhookTriggerOptions } from './dispatchPlanning.ts'
import { cleanList, firstClean, recordOrEmpty } from '../webhookValueUtils.ts'
import { normalizeMatchedTerm } from '../webhookAlertNormalization.ts'
import { parseCount } from '../webhookDeliveryUtilities.ts'
import { parseEventType } from '../webhookDestinationInput.ts'

export function buildDwmAlertWebhookNotificationInput(
    alert: Record<string, unknown>,
    options: DwmAlertWebhookTriggerOptions = {}
): DwmAlertNotificationInput {
    const workflowContext = recordOrEmpty(alert.workflowContext)
    const webhookContext = recordOrEmpty(alert.webhookContext)
    const matchedTerm = normalizeMatchedTerm(alert.matchedTerm || workflowContext.matchedTerm)
    const watchlistIds = [
        ...cleanList(alert.watchlistItemIds),
        ...cleanList(webhookContext.watchlistItemIds),
        ...cleanList(workflowContext.watchlistItemIds),
        ...cleanList(alert.watchlistIds),
        ...cleanList(webhookContext.watchlistIds),
        ...cleanList(workflowContext.watchlistIds),
    ]
    const orgId = firstClean(
        alert.organizationId,
        alert.orgId,
        webhookContext.organizationId,
        workflowContext.organizationId,
        alert.tenantId,
        webhookContext.tenantId,
        workflowContext.tenantId
    )
    const tenantId = firstClean(alert.tenantId, webhookContext.tenantId, workflowContext.tenantId)
    const watchlistRecord = recordOrEmpty(alert.watchlist)
    const watchlistId = firstClean(watchlistRecord.id, alert.watchlistItemId, alert.watchlistId, watchlistIds[0])
    const watchlistName = firstClean(watchlistRecord.name, alert.watchlistName, webhookContext.watchlistName, workflowContext.watchlistName)
    const watchlistTerms = cleanList(watchlistRecord.terms)
    const dedupeKey = firstClean(
        alert.dedupeKey,
        webhookContext.dedupeKey,
        workflowContext.dedupeKey,
        recordOrEmpty(alert.webhookDelivery).dedupeKey,
        alert.id,
        webhookContext.alertId
    )
    const route = firstClean(
        alert.route,
        alert.recommendedRoute,
        webhookContext.recommendedRoute,
        workflowContext.recommendedRoute,
        recordOrEmpty(alert.webhookDelivery).recommendedRoute
    )
    const casePath = firstClean(alert.casePath, alert.caseUrl, webhookContext.casePath, workflowContext.casePath)
    const alertUrl = firstClean(alert.alertUrl, alert.alertURL, alert.deepLink, alert.url, webhookContext.alertUrl, webhookContext.deepLink, workflowContext.alertUrl, workflowContext.deepLink)
    const caseId = firstClean(alert.caseId, alert.caseIdCandidate, webhookContext.caseIdCandidate, workflowContext.caseIdCandidate)
    const evidenceCount = parseCount(alert.evidenceCount ?? webhookContext.evidenceCount ?? workflowContext.evidenceCount)
    const sourceFamily = firstClean(alert.sourceFamily, webhookContext.sourceFamily, workflowContext.sourceFamily)
    const provenance = alert.provenance || webhookContext.provenance || {
        captureIds: cleanList(webhookContext.captureIds).length ? cleanList(webhookContext.captureIds) : cleanList(workflowContext.captureIds),
        primaryCaptureId: firstClean(webhookContext.primaryCaptureId, workflowContext.primaryCaptureId),
    }

    return {
        orgId,
        organizationId: orgId,
        tenantId,
        destinationId: firstClean(options.destinationId, options.destination_id),
        eventType: parseEventType(options.eventType, parseEventType(webhookContext.eventType || alert.eventType, 'dwm.alert.created')),
        alertId: firstClean(alert.id, webhookContext.alertId),
        watchlistItemId: watchlistId,
        watchlistId,
        watchlistName,
        dedupeKey,
        route,
        recommendedRoute: route,
        casePath,
        evidenceCount,
        sourceFamily,
        dryRun: options.dryRun ?? options.dry_run,
        live: options.live,
        alert: {
            ...alert,
            id: firstClean(alert.id, webhookContext.alertId),
            organizationId: orgId,
            tenantId,
            watchlist: {
                ...watchlistRecord,
                id: watchlistId,
                name: watchlistName,
                terms: watchlistTerms.length ? watchlistTerms : [matchedTerm.value].filter(Boolean),
            },
            matchedTerm,
            sourceFamily,
            evidenceCount,
            dedupeKey,
            route,
            recommendedRoute: route,
            casePath,
            alertUrl,
            caseId,
            provenance,
        },
    }
}

export function buildDwmWebhookDeliveryRequestInput(input: DwmAlertNotificationInput): DwmAlertNotificationInput {
    const alert = input.alert && typeof input.alert === 'object' ? input.alert : null
    if (!alert) return input

    const normalized = buildDwmAlertWebhookNotificationInput(alert, {
        eventType: input.eventType ?? input.event_type,
        destinationId: input.destinationId ?? input.destination_id,
        dryRun: input.dryRun ?? input.dry_run,
        live: input.live,
    })
    const orgId = firstClean(input.orgId, input.organizationId, input.tenantId, normalized.orgId, normalized.organizationId, normalized.tenantId)

    return {
        ...input,
        ...normalized,
        orgId,
        organizationId: orgId,
    }
}
