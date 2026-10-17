import { buildDwmWebhookDispatchPlanForDestinations } from '../dispatchPlanning.ts'
import { buildDwmWebhookDeliveryRequestInput } from '../notificationInput.ts'
import type { DwmAlertNotificationInput } from '../../webhookDestinationTypes.ts'
import { clean, firstClean, recordOrEmpty, uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { parseBoolean, parseEventType } from '../../webhookDestinationInput.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { buildDwmWebhookDeliveryLedger } from '../../webhookDeliveryLedger.ts'
import { buildDwmWebhookDeliveryOperations } from '../../webhookDeliveryOperations.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic, type DwmWebhookDeliveryOperationBlockerCode } from './webhook-contract-types.ts'
import { buildDwmWebhookDestinationHealth } from './destination-health.ts'
import { operationBlocker } from './retry-queue-blocker.ts'

export function buildDwmWebhookDeliveryRetryContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    canManage = false,
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    canManage?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const orgId = firstClean(normalizedInput.orgId, normalizedInput.organizationId, normalizedInput.tenantId)
    const eventType = parseEventType(normalizedInput.eventType ?? normalizedInput.event_type, 'dwm.alert.replayed')
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const destinationId = clean(normalizedInput.destinationId ?? normalizedInput.destination_id)
    const alertContext = recordOrEmpty(normalizedInput.alert)
    const alertId = firstClean(normalizedInput.alertId, alertContext.id, alertContext.alertId)
    const dedupeKey = firstClean(normalizedInput.dedupeKey, alertContext.dedupeKey, alertId)
    const dispatch = buildDwmWebhookDispatchPlanForDestinations(ownerId, normalizedInput, destinations)
    const destinationHealth = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const healthByDestination = new Map(destinationHealth.map(health => [health.destinationId, health]))
    const ledger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const selectedIds = new Set(dispatch.selectedDestinations.map(destination => destination.id))
    const candidateDestinationIds = destinationId ? [destinationId] : [
        ...dispatch.selectedDestinations.map(destination => destination.id),
        ...dispatch.skippedDestinations.map(destination => destination.id),
    ]
    const blockers: Array<{
        code: DwmWebhookDeliveryOperationBlockerCode
        message: string
        destinationId: string | null
        retryable: boolean
    }> = []

    if (!orgId) blockers.push(operationBlocker('missing_org', 'Organization context is required before retrying webhook delivery.'))
    if (!alertId && !dedupeKey) blockers.push(operationBlocker('missing_alert_context', 'Alert id or dedupe key is required before retrying webhook delivery.'))
    if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(operationBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.'))
    if (destinationId && !destinations.some(destination => destination.id === destinationId)) {
        blockers.push(operationBlocker('not_found', 'Destination is not available for this organization.', destinationId))
    }

    for (const candidateId of candidateDestinationIds) {
        const destination = destinations.find(item => item.id === candidateId)
        const health = candidateId ? healthByDestination.get(candidateId) || null : null
        if (!destination) continue
        if (destination.status !== 'active') {
            blockers.push(operationBlocker('destination_disabled', 'Destination is disabled and cannot be retried.', destination.id))
        }
        if (!destination.endpointHint || !destination.endpointHash) {
            blockers.push(operationBlocker('missing_webhook_url', 'Destination does not have a configured webhook URL.', destination.id))
        }
        if (health && !health.ready && !health.blockers.every(blocker => blocker === 'live_delivery_disabled' || blocker === 'retry_scheduled')) {
            blockers.push(operationBlocker('destination_unhealthy', 'Destination health is not ready for customer delivery.', destination.id, Boolean(health.retry.retryable)))
        }
    }

    const targetIds = selectedIds.size > 0 ? selectedIds : new Set(candidateDestinationIds.filter(Boolean))
    for (const targetId of targetIds) {
        const idempotencyKey = orgId && targetId && dedupeKey
            ? buildIdempotencyKey(eventType, orgId, targetId, dedupeKey)
            : ''
        if (!idempotencyKey) continue
        const related = ledger.filter(attempt => attempt.idempotencyKey === idempotencyKey)
        const sent = related.find(attempt => attempt.status === 'sent')
        const latest = [...related].sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))[0]
        if (sent) {
            blockers.push(operationBlocker('dedupe_already_delivered', 'This alert/destination idempotency key has already been delivered.', targetId))
        } else if (latest && !latest.retryable && latest.status !== 'queued') {
            blockers.push(operationBlocker('retry_not_eligible', 'Latest delivery attempt is not eligible for retry.', targetId))
        }
    }

    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    return {
        schemaVersion: 'dwm.webhook.delivery_retry.v1',
        ownerId,
        orgId: orgId || null,
        eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        canRetry: canManage && uniqueBlockers.length === 0,
        canTest: canManage && uniqueBlockers.every(blocker => blocker.code !== 'missing_org' && blocker.code !== 'not_found'),
        access: {
            canManage,
            canRetry: canManage,
            canTest: canManage,
        },
        destinationSelection: {
            requestedDestinationId: destinationId || null,
            selectedDestinationIds: dispatch.selectedDestinations.map(destination => destination.id),
            skippedDestinations: dispatch.skippedDestinations,
        },
        blockers: uniqueBlockers,
        deliveryOperations: buildDwmWebhookDeliveryOperations({
            deliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: destinationId || undefined,
                alertId: alertId || undefined,
                dedupeKey: dedupeKey || undefined,
            },
            liveDeliveryEnabled,
        }),
    }
}
