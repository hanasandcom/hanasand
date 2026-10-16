import type { DwmAlertWebhookDispatchPlan, DwmAlertWebhookMissingDeliveryIntent, DwmAlertWebhookSkippedDeliveryIntent } from './dispatchPlanning.ts'
import { normalizeAlert } from '../webhookAlertNormalization.ts'
import { buildIdempotencyKey } from '../webhookDeliveryUtilities.ts'

export function buildDwmAlertWebhookSkippedDeliveryIntents(
    plan: DwmAlertWebhookDispatchPlan
): DwmAlertWebhookSkippedDeliveryIntent[] {
    const normalizedAlert = normalizeAlert(plan.alert)
    const alertDedupe = normalizedAlert.dedupeKey || normalizedAlert.id
    return plan.skippedDestinations
        .filter(skipped => skipped.reason !== 'org_mismatch')
        .map(skipped => {
            const reason = skipped.reason as DwmAlertWebhookSkippedDeliveryIntent['reason']
            return {
                destinationId: skipped.id,
                orgId: skipped.orgId,
                status: skipped.status,
                reason,
                idempotencyKey: buildIdempotencyKey(plan.eventType, plan.orgId, skipped.id, alertDedupe),
                error: reason === 'disabled'
                    ? 'Delivery selection skipped because this destination is disabled.'
                    : `Delivery selection skipped because this destination is not subscribed to ${plan.eventType}.`,
                persistable: true as const,
            }
        })
}

export function buildDwmAlertWebhookMissingDeliveryIntent(
    plan: DwmAlertWebhookDispatchPlan,
    requestedDestinationId: string | null = null
): DwmAlertWebhookMissingDeliveryIntent | null {
    if (plan.selectedDestinations.length > 0) return null
    if (plan.skippedDestinations.some(skipped => skipped.reason !== 'org_mismatch')) return null

    const normalizedAlert = normalizeAlert(plan.alert)
    const reason = requestedDestinationId ? 'requested_destination_not_found' : 'missing_destination'
    return {
        orgId: plan.orgId,
        reason,
        requestedDestinationId,
        idempotencyKey: buildIdempotencyKey(plan.eventType, plan.orgId, requestedDestinationId || 'missing_destination', normalizedAlert.dedupeKey || normalizedAlert.id),
        error: requestedDestinationId
            ? 'Delivery selection skipped because the requested webhook destination was not found for this organization.'
            : 'Delivery selection skipped because no enabled webhook destination is configured for this organization.',
        persistable: true,
    }
}

