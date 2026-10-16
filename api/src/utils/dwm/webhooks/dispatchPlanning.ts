import type { DwmAlertEventType, DwmAlertNotificationInput, DwmWebhookDestinationRow, DwmWebhookStatus } from '../webhookDestinationTypes.ts'
import type { toDwmWebhookDestination } from '../webhookDestinationModels.ts'
import { clean } from '../webhookValueUtils.ts'
import { parseCount } from '../webhookDeliveryUtilities.ts'
import { parseEventType } from '../webhookDestinationInput.ts'

export type DwmWebhookDestinationPublic = ReturnType<typeof toDwmWebhookDestination>

export type DwmAlertWebhookTriggerOptions = {
    eventType?: unknown
    destinationId?: unknown
    destination_id?: unknown
    dryRun?: unknown
    dry_run?: unknown
    live?: unknown
}

export type DwmWebhookDispatchDestination = Pick<DwmWebhookDestinationRow,
    'id' | 'org_id' | 'name' | 'kind' | 'status' | 'events'
>

export type DwmAlertWebhookDispatchPlan = {
    ownerId: string
    orgId: string
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    selectedDestinations: DwmWebhookDispatchDestination[]
    skippedDestinations: Array<{
        id: string
        orgId: string
        status: DwmWebhookStatus
        reason: 'org_mismatch' | 'disabled' | 'event_not_subscribed'
    }>
}

export type DwmAlertWebhookSkippedDeliveryIntent = {
    destinationId: string
    orgId: string
    status: DwmWebhookStatus
    reason: 'disabled' | 'event_not_subscribed'
    idempotencyKey: string
    error: string
    persistable: true
}

export type DwmAlertWebhookMissingDeliveryIntent = {
    orgId: string
    reason: 'missing_destination' | 'requested_destination_not_found'
    requestedDestinationId: string | null
    idempotencyKey: string
    error: string
    persistable: true
}

export function buildDwmWebhookDispatchPlanForDestinations(
    ownerId: string,
    input: DwmAlertNotificationInput,
    destinations: DwmWebhookDestinationPublic[],
) {
    return buildDwmAlertWebhookDispatchPlan({
        ownerId,
        input,
        destinations: destinations.map(destination => ({
            id: destination.id,
            org_id: destination.orgId,
            name: destination.name,
            kind: destination.kind,
            status: destination.status,
            events: destination.events,
        })),
    })
}

export function buildDwmAlertWebhookDispatchPlan({
    ownerId,
    input,
    destinations,
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDispatchDestination[]
}): DwmAlertWebhookDispatchPlan {
    const eventType = parseEventType(input.eventType ?? input.event_type, 'dwm.alert.created')
    const alert = normalizeDispatchAlertInput(input)
    const orgId = dispatchOrganizationId(ownerId, input, alert)
    return buildDwmAlertWebhookDispatchPlanForAlert({ ownerId, eventType, alert, orgId, destinations })
}

export function dispatchOrganizationId(
    ownerId: string,
    input: DwmAlertNotificationInput,
    alert: Record<string, unknown>,
) {
    return clean(input.orgId)
        || clean(input.organizationId)
        || clean(input.tenantId)
        || clean(alert.organizationId)
        || clean(alert.orgId)
        || clean(alert.tenantId)
        || ownerId
}

export function buildDwmAlertWebhookDispatchPlanForAlert({
    ownerId,
    eventType,
    alert,
    orgId,
    destinations,
}: {
    ownerId: string
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    orgId: string
    destinations: DwmWebhookDispatchDestination[]
}): DwmAlertWebhookDispatchPlan {
    const selectedDestinations: DwmWebhookDispatchDestination[] = []
    const skippedDestinations: DwmAlertWebhookDispatchPlan['skippedDestinations'] = []

    for (const destination of destinations) {
        if (destination.org_id !== orgId) {
            skippedDestinations.push({ id: destination.id, orgId: destination.org_id, status: destination.status, reason: 'org_mismatch' })
            continue
        }
        if (destination.status !== 'active') {
            skippedDestinations.push({ id: destination.id, orgId: destination.org_id, status: destination.status, reason: 'disabled' })
            continue
        }
        if (!destination.events.includes(eventType)) {
            skippedDestinations.push({ id: destination.id, orgId: destination.org_id, status: destination.status, reason: 'event_not_subscribed' })
            continue
        }
        selectedDestinations.push(destination)
    }

    return {
        ownerId,
        orgId,
        eventType,
        alert,
        selectedDestinations,
        skippedDestinations,
    }
}

export function normalizeDispatchAlertInput(input: DwmAlertNotificationInput) {
    const nested = input.alert && typeof input.alert === 'object' ? input.alert : {}
    const watchlist = nested.watchlist && typeof nested.watchlist === 'object'
        ? nested.watchlist
        : {
            id: clean(input.watchlistItemId) || clean(input.watchlistId),
            name: clean(input.watchlistName),
            terms: [],
        }

    return {
        ...input,
        ...nested,
        id: clean(nested.id) || clean(input.alertId) || clean((input as Record<string, unknown>).id),
        organizationId: clean(nested.organizationId) || clean(input.organizationId) || clean(input.orgId),
        tenantId: clean(nested.tenantId) || clean(input.tenantId),
        watchlist,
        dedupeKey: clean(nested.dedupeKey) || clean(input.dedupeKey) || clean((nested.webhookDelivery as Record<string, unknown> | undefined)?.dedupeKey),
        route: clean(nested.route) || clean(input.route) || clean(input.recommendedRoute),
        recommendedRoute: clean(nested.recommendedRoute) || clean(input.recommendedRoute) || clean(input.route),
        casePath: clean(nested.casePath) || clean(input.casePath) || clean(input.caseUrl),
        evidenceCount: parseCount(nested.evidenceCount ?? input.evidenceCount),
        sourceFamily: clean(nested.sourceFamily) || clean(input.sourceFamily),
    }
}
