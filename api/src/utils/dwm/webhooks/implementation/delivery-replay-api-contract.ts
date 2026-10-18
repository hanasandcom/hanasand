import type { DwmAlertWebhookDispatchPlan, DwmAlertWebhookTriggerOptions, DwmWebhookDispatchDestination } from '../dispatchPlanning.ts'
import { buildDwmAlertWebhookNotificationInput } from '../notificationInput.ts'
import { buildDwmWebhookDeliveryReplayApiProjection } from '../deliveryReplayApiProjection.ts'
import type { DwmAlertEventType, DwmAlertNotificationInput, DwmWebhookDestinationRow } from '../../webhookDestinationTypes.ts'
import { clean, firstClean, recordOrEmpty } from '../../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { WEBHOOK_KINDS } from '../../webhookDestinationInput.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { withDatabaseAdvisoryLock } from '#db'
import { type DwmWebhookDeliveryEvidenceAccessOptions, type DwmWebhookDestinationPublic } from './webhook-contract-types.ts'
import { deliveryEvidenceAccessDefaults } from './delivery-evidence-defaults.ts'
import { buildDwmWebhookDeliveryAttemptPersistenceReadModel } from './delivery-attempt-persistence-read-model.ts'
import { buildDwmWebhookDeliveryReplayGuard } from './delivery-replay-guard.ts'
import { deliverDwmAlertNotification } from './test-destination.ts'
import { findDeliveredDwmWebhookDelivery } from './dwm-webhook-delivery-audit-metadata.ts'
import { recordSkippedDuplicateDwmWebhookDelivery } from './send-dwm-webhook-payload.ts'
import { deliverToDwmWebhookDestination } from './deliver-dwm-webhook-destination.ts'

export function buildDwmWebhookDeliveryReplayApiContract(options: DwmWebhookDeliveryEvidenceAccessOptions) {
    const { deliveries, auditEvents, destinations, filters, liveDeliveryEnabled, viewerRole, canManage, visibility } = deliveryEvidenceAccessDefaults(options)
    const readModel = buildDwmWebhookDeliveryAttemptPersistenceReadModel({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    const replayGuard = buildDwmWebhookDeliveryReplayGuard({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    return buildDwmWebhookDeliveryReplayApiProjection(readModel, replayGuard, liveDeliveryEnabled)
}

export function toDwmWebhookDispatchDestinationForContract(destination: DwmWebhookDispatchDestination | DwmWebhookDestinationPublic): DwmWebhookDispatchDestination {
    const dispatchDestination = destination as DwmWebhookDispatchDestination
    const publicDestination = destination as DwmWebhookDestinationPublic
    return {
        id: destination.id,
        org_id: clean(dispatchDestination.org_id) || clean(publicDestination.orgId) || '',
        name: destination.name,
        kind: destination.kind,
        status: destination.status,
        events: Array.isArray(destination.events) ? destination.events : [],
    }
}

export function deliveryAttemptContractBlockers({
    input,
    plan,
    alert,
    watchlist,
}: {
    input: DwmAlertNotificationInput
    plan: DwmAlertWebhookDispatchPlan
    alert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
}) {
    const blockers: Array<{ code: string; path: string; message: string; blocking: true }> = []
    const add = (code: string, path: string, message: string) => blockers.push({ code, path, message, blocking: true })
    const inputAlert = recordOrEmpty(input.alert)
    if (!firstClean(input.orgId, input.organizationId, input.tenantId, inputAlert.organizationId, inputAlert.orgId, inputAlert.tenantId)) add('missing_org_id', 'orgId', 'Webhook delivery requires organization scope.')
    if (!firstClean(input.alertId, inputAlert.id)) add('missing_alert_id', 'alert.id', 'Webhook delivery requires a persisted alert id.')
    if (!firstClean(inputAlert.title)) add('missing_alert_title', 'alert.title', 'Webhook delivery requires an alert title for Discord rendering.')
    if (!firstClean(inputAlert.severity)) add('missing_severity', 'alert.severity', 'Webhook delivery requires alert severity.')
    if (!firstClean(input.sourceFamily, inputAlert.sourceFamily)) add('missing_source_family', 'alert.sourceFamily', 'Webhook delivery requires source family context.')
    if (!watchlist.id && !firstClean(input.watchlistItemId, input.watchlistId)) add('missing_watchlist_id', 'alert.watchlist.id', 'Webhook delivery requires watchlist identity.')
    if (!firstClean(input.dedupeKey, inputAlert.dedupeKey)) add('missing_dedupe_key', 'alert.dedupeKey', 'Webhook delivery requires a dedupe key for idempotency.')
    if (alert.evidenceCount <= 0 && alert.evidence.length === 0) add('missing_evidence', 'alert.evidence', 'Webhook delivery requires at least one evidence item or evidence count.')
    if (!alert.provenanceSummary) add('missing_provenance', 'alert.provenance', 'Webhook delivery requires source provenance context.')
    if (!alert.eventTimestamp) add('missing_timestamp', 'alert.eventTimestamp', 'Webhook delivery requires an alert event timestamp.')
    if (!alert.alertUrl && !alert.casePath) add('missing_alert_link', 'alert.alertUrl', 'Webhook delivery requires an alert or case link.')
    for (const destination of plan.selectedDestinations) {
        if (!WEBHOOK_KINDS.has(destination.kind)) {
            add('unsupported_destination_type', `destinations.${destination.id}.kind`, 'Webhook delivery only supports discord and webhook destinations.')
        }
    }
    if (!plan.selectedDestinations.length && !plan.skippedDestinations.some(destination => destination.reason !== 'org_mismatch')) {
        add('missing_destination', 'destinations', 'Webhook delivery requires an org-scoped destination or a persistable missing-destination attempt.')
    }
    return blockers
}

export async function triggerDwmAlertWebhookNotification(
    ownerId: string,
    alert: Record<string, unknown>,
    options: DwmAlertWebhookTriggerOptions = {}
) {
    return deliverDwmAlertNotification(ownerId, buildDwmAlertWebhookNotificationInput(alert, options))
}

export async function deliverToDwmWebhookDestinationWithLineageGuard(input: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    live: boolean
    markTested: boolean
    sender?: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }>
}) {
    const normalizedAlert = normalizeAlert(input.alert)
    const idempotencyKey = buildIdempotencyKey(
        input.eventType,
        input.destination.org_id,
        input.destination.id,
        normalizedAlert.dedupeKey || normalizedAlert.id
    )
    return withDatabaseAdvisoryLock(`dwm-webhook-delivery:${idempotencyKey}`, async () => {
        const delivered = input.live && !input.dryRun
            ? await findDeliveredDwmWebhookDelivery(input.destination.org_id, input.destination.id, idempotencyKey)
            : null
        if (delivered) {
            return recordSkippedDuplicateDwmWebhookDelivery({
                ownerId: input.ownerId,
                destination: input.destination,
                eventType: input.eventType,
                alert: input.alert,
                priorDelivery: delivered,
            })
        }
        return deliverToDwmWebhookDestination(input)
    })
}
