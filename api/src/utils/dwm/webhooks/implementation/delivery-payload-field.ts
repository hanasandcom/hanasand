import type { DwmAlertWebhookDispatchPlan, DwmWebhookDispatchDestination } from '../dispatchPlanning.ts'
import type { DwmAlertNotificationInput } from '../../webhookDestinationTypes.ts'
import { clean, firstClean, recordOrEmpty } from '../../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { redactDeliveryEvidenceText } from '../../webhookDeliveryUtilities.ts'
import { type DwmWebhookDestinationPublic } from './webhook-contract-types.ts'

export function deliveryPayloadField<Key extends string>(key: Key, paths: string[], present: boolean) {
    return { key, paths, present }
}

export function buildDwmWebhookDeliveryPayloadFieldContract({
    input,
    plan,
    alert,
    watchlist,
    dryRun,
    live,
}: {
    input: DwmAlertNotificationInput
    plan: DwmAlertWebhookDispatchPlan
    alert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    dryRun: boolean
    live: boolean
}) {
    const inputRecord = recordOrEmpty(input)
    const inputAlert = recordOrEmpty(input.alert)
    const required = [
        deliveryPayloadField('orgId', ['orgId', 'organizationId', 'tenantId', 'alert.organizationId', 'alert.orgId', 'alert.tenantId'], Boolean(firstClean(input.orgId, input.organizationId, input.tenantId, inputAlert.organizationId, inputAlert.orgId, inputAlert.tenantId))),
        deliveryPayloadField('destinationId', ['destinationId', 'destination_id', 'destinations[].id'], Boolean(clean(input.destinationId ?? input.destination_id)) || plan.selectedDestinations.length > 0),
        deliveryPayloadField('alertId', ['alertId', 'alert.id'], Boolean(firstClean(input.alertId, inputAlert.id))),
        deliveryPayloadField('watchlistId', ['watchlistItemId', 'watchlistId', 'alert.watchlist.id'], Boolean(watchlist.id || clean(input.watchlistItemId) || clean(input.watchlistId))),
        deliveryPayloadField('severity', ['alert.severity'], Boolean(firstClean(inputAlert.severity))),
        deliveryPayloadField('title', ['alert.title'], Boolean(firstClean(inputAlert.title))),
        deliveryPayloadField('sourceFamily', ['sourceFamily', 'alert.sourceFamily'], Boolean(firstClean(input.sourceFamily, inputAlert.sourceFamily))),
        deliveryPayloadField('evidence', ['alert.evidence', 'alert.evidenceCount'], alert.evidenceCount > 0 || alert.evidence.length > 0),
        deliveryPayloadField('provenance', ['alert.provenance', 'alert.provenanceSummary'], Boolean(alert.provenanceSummary)),
        deliveryPayloadField('timestamp', ['alert.eventTimestamp', 'alert.detectedAt', 'alert.createdAt', 'alert.updatedAt'], Boolean(alert.eventTimestamp)),
        deliveryPayloadField('link', ['alert.alertUrl', 'alert.casePath', 'casePath', 'caseUrl'], Boolean(alert.alertUrl || alert.casePath)),
        deliveryPayloadField('dedupeKey', ['dedupeKey', 'alert.dedupeKey'], Boolean(firstClean(input.dedupeKey, inputAlert.dedupeKey))),
    ]
    const optional = [
        deliveryPayloadField('caseId', ['caseId', 'alert.caseId'], Boolean(firstClean(inputRecord.caseId, inputAlert.caseId))),
        deliveryPayloadField('casePath', ['casePath', 'caseUrl', 'alert.casePath', 'alert.caseUrl'], Boolean(alert.casePath)),
        deliveryPayloadField('caseAction', ['caseActionId', 'caseActionPath', 'actionId', 'actionPath', 'alert.caseActionId', 'alert.caseActionPath'], Boolean(alert.caseActionId || alert.caseActionPath)),
        deliveryPayloadField('route', ['route', 'recommendedRoute', 'alert.route', 'alert.recommendedRoute'], Boolean(alert.route)),
        deliveryPayloadField('confidence', ['alert.confidence', 'alert.confidenceScore', 'alert.confidenceReason'], Boolean(firstClean(inputAlert.confidence, inputAlert.confidenceScore, inputAlert.confidenceReason))),
        deliveryPayloadField('dryRunState', ['dryRun', 'dry_run'], true),
        deliveryPayloadField('liveState', ['live'], live),
        deliveryPayloadField('replayState', ['eventType', 'event_type'], plan.eventType === 'dwm.alert.replayed'),
    ]
    const missingRequired = required.filter(field => !field.present).map(field => field.key)
    return {
        schemaVersion: 'dwm.webhook.delivery_payload_contract.v1',
        noNetworkDefault: true,
        dryRun,
        liveRequested: live,
        replay: plan.eventType === 'dwm.alert.replayed',
        eventType: plan.eventType,
        required,
        optional,
        missingRequired,
    }
}

export function deliveryAttemptRedactedEndpoint(destination: DwmWebhookDispatchDestination | DwmWebhookDestinationPublic | undefined) {
    const publicDestination = destination as DwmWebhookDestinationPublic | undefined
    return {
        endpointHint: publicDestination?.endpointHint ? redactDeliveryEvidenceText(publicDestination.endpointHint) : null,
        endpointHash: publicDestination?.endpointHash || null,
    }
}
