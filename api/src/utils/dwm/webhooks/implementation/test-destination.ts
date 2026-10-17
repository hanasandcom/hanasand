import { buildDwmAlertWebhookDispatchPlanForAlert, dispatchOrganizationId, normalizeDispatchAlertInput } from '../dispatchPlanning.ts'
import { buildDwmAlertWebhookMissingDeliveryIntent, buildDwmAlertWebhookSkippedDeliveryIntents } from '../dispatchIntents.ts'
import { buildDwmWebhookTestAlert } from '../payloadPreviews.ts'
import type { DwmAlertNotificationInput, DwmWebhookDestinationRow } from '../../webhookDestinationTypes.ts'
import { clean } from '../../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { parseBoolean, parseEventType } from '../../webhookDestinationInput.ts'
import { loadDestinationsForOrg, loadDwmWebhookDestination } from '../../webhookDestinationReads.ts'
import { postPublicWebhook } from '../../webhookTransport.ts'
import { deliverToDwmWebhookDestinationWithLineageGuard, deliveryAttemptContractBlockers } from './delivery-replay-api-contract.ts'
import { recordSkippedSelectionDwmWebhookDelivery } from './send-dwm-webhook-payload.ts'
import { recordMissingDestinationDwmWebhookDelivery } from './record-missing-destination-dwm-webhook-delivery.ts'

export async function testDwmWebhookDestination(ownerId: string, id: string, input: DwmAlertNotificationInput = {}) {
    const destination = await loadDwmWebhookDestination(ownerId, id)
    if (!destination || destination.status === 'archived') return null

    const delivery = await deliverToDwmWebhookDestinationWithLineageGuard({
        ownerId,
        destination,
        eventType: 'dwm.alert.test',
        alert: buildDwmWebhookTestAlert(destination),
        dryRun: parseBoolean(input.dryRun ?? input.dry_run, true),
        live: parseBoolean(input.live, false),
        markTested: true,
    })

    return delivery
}

export async function deliverDwmAlertNotification(
    ownerId: string,
    input: DwmAlertNotificationInput,
    sender: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }> = postPublicWebhook
) {
    const eventType = parseEventType(input.eventType ?? input.event_type, 'dwm.alert.created')
    const alert = normalizeDispatchAlertInput(input)
    const orgId = dispatchOrganizationId(ownerId, input, alert)
    const destinationId = clean(input.destinationId ?? input.destination_id)
    const dryRun = parseBoolean(input.dryRun ?? input.dry_run, true)
    const live = parseBoolean(input.live, false)
    const destination = destinationId ? await loadDwmWebhookDestination(ownerId, destinationId) : null
    const candidateDestinations = destinationId
        ? (destination ? [destination] : [])
        : await loadDestinationsForOrg(ownerId, orgId)
    const plan = buildDwmAlertWebhookDispatchPlanForAlert({
        ownerId,
        eventType,
        alert,
        orgId,
        destinations: candidateDestinations,
    })
    const normalizedPlanAlert = normalizeAlert(plan.alert)
    const deliveryBlockers = deliveryAttemptContractBlockers({
        input,
        plan,
        alert: normalizedPlanAlert,
        watchlist: normalizeWatchlist(plan.alert.watchlist),
    })
    const missingIntent = buildDwmAlertWebhookMissingDeliveryIntent(plan, destinationId || null)
    const remainingDeliveryBlockers = deliveryBlockers.filter(blocker => !(
        blocker.code === 'missing_destination'
        && destinationId
        && missingIntent?.reason === 'requested_destination_not_found'
    ))
    if (remainingDeliveryBlockers.length) {
        const error = new Error(remainingDeliveryBlockers[0].message)
        Object.assign(error, { code: remainingDeliveryBlockers[0].code, blockers: remainingDeliveryBlockers })
        throw error
    }

    const deliveries = []
    const persistableSkipped = buildDwmAlertWebhookSkippedDeliveryIntents(plan)
    const destinationsById = new Map(candidateDestinations.map(destination => [destination.id, destination as DwmWebhookDestinationRow]))
    for (const skipped of persistableSkipped) {
        const destination = destinationsById.get(skipped.destinationId)
        if (!destination) continue
        deliveries.push(await recordSkippedSelectionDwmWebhookDelivery({
            ownerId,
            destination,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            intent: skipped,
        }))
    }
    if (!plan.selectedDestinations.length && !persistableSkipped.length && missingIntent) {
        deliveries.push(await recordMissingDestinationDwmWebhookDelivery({
            ownerId,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            intent: missingIntent,
        }))
    }
    for (const destination of plan.selectedDestinations) {
        deliveries.push(await deliverToDwmWebhookDestinationWithLineageGuard({
            ownerId,
            destination: destination as DwmWebhookDestinationRow,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            live,
            markTested: false,
            sender,
        }))
    }

    return deliveries
}
