import { buildDwmAlertWebhookDispatchPlan } from '../dispatchPlanning.ts'
import type { DwmWebhookDispatchDestination } from '../dispatchPlanning.ts'
import { buildDwmAlertWebhookMissingDeliveryIntent, buildDwmAlertWebhookSkippedDeliveryIntents } from '../dispatchIntents.ts'
import { buildDwmWebhookDeliveryRequestInput } from '../notificationInput.ts'
import { buildDwmAlertDeliveryPayload } from '../alertDeliveryPayload.ts'
import { buildDwmWebhookDestinationTestPayloadPreview } from '../payloadPreviews.ts'
import type { DwmAlertNotificationInput } from '../../webhookDestinationTypes.ts'
import { clean } from '../../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { parseBoolean } from '../../webhookDestinationInput.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { planDwmWebhookDeliveryRetry } from '../../webhookDeliveryRetryPolicy.ts'
import { hashValue as hashWebhookValue } from '../../webhookTransport.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic } from './webhook-contract-types.ts'
import { indexWebhookDeliveriesByIdempotencyKey } from './delivery-attempt-persistence-read-model.ts'
import { toDwmWebhookDispatchDestinationForContract, deliveryAttemptContractBlockers } from './delivery-replay-api-contract.ts'
import { buildDwmWebhookDeliveryPayloadFieldContract, deliveryAttemptRedactedEndpoint } from './delivery-payload-field.ts'

export function buildDwmWebhookDeliveryAttemptContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: Array<DwmWebhookDispatchDestination | DwmWebhookDestinationPublic>
    deliveries?: DwmWebhookDeliveryPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const live = parseBoolean(normalizedInput.live, false)
    const destinationMetadataById = new Map(destinations.map(destination => [destination.id, destination]))
    const dispatchDestinations = destinations.map(toDwmWebhookDispatchDestinationForContract)
    const plan = buildDwmAlertWebhookDispatchPlan({ ownerId, input: normalizedInput, destinations: dispatchDestinations })
    const alert = normalizeAlert(plan.alert)
    const watchlist = normalizeWatchlist(plan.alert.watchlist)
    const payloadContract = buildDwmWebhookDeliveryPayloadFieldContract({
        input: normalizedInput,
        plan,
        alert,
        watchlist,
        dryRun,
        live,
    })
    const requiredFields = Object.fromEntries(
        payloadContract.required.map(field => [field.key, field.present]),
    ) as Record<(typeof payloadContract.required)[number]['key'], boolean>
    const requiredBlockers = deliveryAttemptContractBlockers({ input: normalizedInput, plan, alert, watchlist })
    const existingByIdempotencyKey = indexWebhookDeliveriesByIdempotencyKey(deliveries)
    const selectedAttempts = plan.selectedDestinations.map((destination) => {
        const idempotencyKey = buildIdempotencyKey(plan.eventType, destination.org_id, destination.id, alert.dedupeKey || alert.id)
        const attemptCount = (existingByIdempotencyKey.get(idempotencyKey)?.length || 0) + 1
        const payload = buildDwmAlertDeliveryPayload({ destination, alert: plan.alert, eventType: plan.eventType, deliveryId: `delivery_contract_${destination.id}` })
        const preview = buildDwmWebhookDestinationTestPayloadPreview(payload)
        const retryPlan = planDwmWebhookDeliveryRetry({ status: dryRun ? 'dry_run' : 'skipped', dryRun, error: live && !dryRun && !liveDeliveryEnabled ? 'Live webhook delivery is disabled for this environment.' : null, attemptCount })
        return {
            destinationId: destination.id,
            orgId: destination.org_id,
            alertId: alert.id,
            eventType: plan.eventType,
            status: dryRun ? 'dry_run' : live && liveDeliveryEnabled ? 'delivered' : 'skipped',
            dryRun,
            live: live && !dryRun && liveDeliveryEnabled,
            replay: plan.eventType === 'dwm.alert.replayed',
            dedupeKey: alert.dedupeKey || idempotencyKey,
            idempotencyKey,
            payloadHash: hashWebhookValue('payload', JSON.stringify(payload)),
            sanitizedPayloadPreview: preview,
            redactedDestination: {
                id: destination.id,
                label: destination.name,
                type: destination.kind,
                ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(destination.id)),
                endpointExposed: false,
            },
            responseSummary: dryRun ? 'Dry-run delivery payload prepared without external network.' : liveDeliveryEnabled ? 'Live delivery is explicitly enabled.' : 'Live delivery is disabled for this environment.',
            error: live && !dryRun && !liveDeliveryEnabled ? 'Live webhook delivery is disabled for this environment.' : null,
            retry: {
                attemptCount,
                retryable: retryPlan.retryable,
                nextRetryAt: retryPlan.nextRetryAt,
                errorClass: retryPlan.errorClass,
                reason: retryPlan.reason,
            },
            audit: {
                expectedAction: dryRun ? 'delivery.tested' : plan.eventType === 'dwm.alert.replayed' ? 'delivery.replayed' : 'delivery.created',
                auditEventId: null,
            },
            timestamps: {
                createdAt: null,
                updatedAt: null,
                attemptedAt: null,
            },
        }
    })
    const skippedAttempts = buildDwmAlertWebhookSkippedDeliveryIntents(plan).map(intent => ({
        destinationId: intent.destinationId,
        orgId: intent.orgId,
        alertId: alert.id,
        eventType: plan.eventType,
        status: 'skipped' as const,
        dryRun,
        live: false,
        replay: plan.eventType === 'dwm.alert.replayed',
        dedupeKey: alert.dedupeKey || intent.idempotencyKey,
        idempotencyKey: intent.idempotencyKey,
        payloadHash: null,
        sanitizedPayloadPreview: null,
        redactedDestination: {
            id: intent.destinationId,
            label: null,
            type: null,
            ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(intent.destinationId)),
            endpointExposed: false,
        },
        responseSummary: intent.error,
        error: intent.error,
        retry: {
            attemptCount: (existingByIdempotencyKey.get(intent.idempotencyKey)?.length || 0) + 1,
            retryable: false,
            nextRetryAt: null,
            errorClass: intent.reason,
            reason: 'selection_blocked',
        },
        audit: {
            expectedAction: 'delivery.skipped',
            auditEventId: null,
        },
        timestamps: {
            createdAt: null,
            updatedAt: null,
            attemptedAt: null,
        },
    }))
    const missingIntent = buildDwmAlertWebhookMissingDeliveryIntent(plan, clean(normalizedInput.destinationId ?? normalizedInput.destination_id) || null)
    const missingAttempts = missingIntent ? [{
        destinationId: missingIntent.requestedDestinationId,
        orgId: missingIntent.orgId,
        alertId: alert.id,
        eventType: plan.eventType,
        status: 'skipped' as const,
        dryRun,
        live: false,
        replay: plan.eventType === 'dwm.alert.replayed',
        dedupeKey: alert.dedupeKey || missingIntent.idempotencyKey,
        idempotencyKey: missingIntent.idempotencyKey,
        payloadHash: null,
        sanitizedPayloadPreview: null,
        redactedDestination: {
            id: missingIntent.requestedDestinationId,
            label: null,
            type: null,
            ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(clean(missingIntent.requestedDestinationId))),
            endpointExposed: false,
        },
        responseSummary: missingIntent.error,
        error: missingIntent.error,
        retry: {
            attemptCount: (existingByIdempotencyKey.get(missingIntent.idempotencyKey)?.length || 0) + 1,
            retryable: false,
            nextRetryAt: null,
            errorClass: missingIntent.reason,
            reason: 'selection_blocked',
        },
        audit: {
            expectedAction: 'delivery.skipped',
            auditEventId: null,
        },
        timestamps: {
            createdAt: null,
            updatedAt: null,
            attemptedAt: null,
        },
    }] : []
    const attempts = [...selectedAttempts, ...skippedAttempts, ...missingAttempts]

    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_contract.v1',
        ok: requiredBlockers.length === 0 && attempts.length > 0,
        ownerId,
        orgId: plan.orgId,
        eventType: plan.eventType,
        dryRun,
        liveRequested: live,
        externalSendEnabled: live && !dryRun && liveDeliveryEnabled,
        noNetwork: !(live && !dryRun && liveDeliveryEnabled),
        normalizedInput,
        payloadContract,
        requiredFields,
        destinationSelection: {
            selectedDestinationIds: plan.selectedDestinations.map(destination => destination.id),
            skippedDestinations: plan.skippedDestinations,
        },
        attempts,
        blockers: requiredBlockers,
    }
}
