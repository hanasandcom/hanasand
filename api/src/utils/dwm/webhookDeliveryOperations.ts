import type { DwmWebhookDeliveryEvidenceFilters } from './webhooks/sharedTypes.ts'
import { toDwmWebhookAuditEvent, toDwmWebhookDelivery, toDwmWebhookDestination } from './webhookDestinationModels.ts'
import { buildDwmWebhookDeliveryEvidenceProjection, normalizeWebhookOperationFilters } from './webhookDeliveryEvidence.ts'
import { buildDwmWebhookDeliveryLedgerFromEvidence } from './webhookDeliveryLedger.ts'
import { buildDwmWebhookAuditEventContractsFromLedger } from './webhookAuditContracts.ts'

type PublicDelivery = ReturnType<typeof toDwmWebhookDelivery>
type PublicAudit = ReturnType<typeof toDwmWebhookAuditEvent>
type PublicDestination = ReturnType<typeof toDwmWebhookDestination>
type DeliveryLedger = ReturnType<typeof buildDwmWebhookDeliveryLedgerFromEvidence>
type AuditContracts = ReturnType<typeof buildDwmWebhookAuditEventContractsFromLedger>

type DeliveryEvidenceOptions = {
    deliveries: PublicDelivery[]
    auditEvents?: PublicAudit[]
    destinations?: PublicDestination[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
}

export function buildDwmWebhookDeliveryOperations({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DeliveryEvidenceOptions) {
    const { ledger, auditContracts } = buildDwmWebhookDeliveryProjectionBundle({ deliveries, auditEvents, destinations, filters })
    return buildDwmWebhookDeliveryOperationsFromProjection({ destinations, filters, liveDeliveryEnabled, ledger, auditContracts })
}

export function buildDwmWebhookDeliveryProjectionBundle({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    now = new Date(),
}: DeliveryEvidenceOptions & { now?: Date }) {
    const projection = buildDwmWebhookDeliveryEvidenceProjection({ deliveries, auditEvents, filters })
    const ledger = buildDwmWebhookDeliveryLedgerFromEvidence({ projection, now })
    const auditContracts = buildDwmWebhookAuditEventContractsFromLedger({ auditEvents, deliveries, destinations, ledger })
    return { projection, ledger, auditContracts }
}

export function buildDwmWebhookDeliveryOperationsFromProjection({
    destinations,
    filters,
    liveDeliveryEnabled,
    ledger,
    auditContracts,
}: {
    destinations: PublicDestination[]
    filters: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled: boolean
    ledger: DeliveryLedger
    auditContracts: AuditContracts
}) {
    const auditByDelivery = new Map(auditContracts.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const destinationsById = new Map(destinations.map(destination => [destination.id, destination]))
    const sortedLedger = [...ledger]
        .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
    const recentDeliveries = sortedLedger.map((attempt) => {
        const destination = attempt.destinationId ? destinationsById.get(attempt.destinationId) || null : null
        const audit = auditByDelivery.get(attempt.deliveryId) || null
        const availability = deliveryDestinationAvailability(attempt)
        return {
            schemaVersion: 'dwm.webhook.delivery_operation.v1',
            requestId: attempt.requestId,
            deliveryId: attempt.deliveryId,
            orgId: attempt.orgId,
            destinationId: attempt.destinationId,
            alertId: attempt.alertId,
            eventType: attempt.eventType,
            status: attempt.status,
            rawStatus: attempt.rawStatus,
            dryRun: attempt.dryRun,
            live: attempt.live,
            liveRequested: attempt.liveRequested,
            replay: attempt.replay,
            idempotencyKey: attempt.idempotencyKey,
            dedupeKey: attempt.dedupeKey,
            watchlistId: attempt.watchlistId,
            watchlistName: attempt.watchlistName,
            route: attempt.route,
            casePath: attempt.casePath,
            caseActionId: attempt.caseActionId,
            caseActionPath: attempt.caseActionPath,
            destination: {
                id: attempt.destinationId,
                label: destination?.name || availability.label,
                type: destination?.kind || availability.type,
                status: destination?.status || availability.status,
                enabled: destination ? destination.status === 'active' : false,
                redactedEndpoint: attempt.redactedDestination,
                availability,
            },
            attempts: {
                count: attempt.attemptCount,
                retryable: attempt.retryable,
                nextRetryAt: attempt.nextRetryAt,
                lastErrorCategory: attempt.errorClass,
                reason: attempt.retryReason,
            },
            response: {
                httpStatus: attempt.responseStatus,
                summary: attempt.responseSummary,
            },
            error: attempt.error,
            payloadHash: attempt.payloadHash,
            auditEventId: audit?.auditEventId || attempt.auditEventId,
            auditAction: audit?.action || attempt.auditAction,
            actorId: audit?.actorId || attempt.actorId,
            retryState: attempt.retryState,
            attemptedAt: attempt.attemptedAt,
            createdAt: attempt.createdAt,
            updatedAt: attempt.updatedAt,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_operations.v1',
        liveDeliveryEnabled,
        filters: normalizeWebhookOperationFilters(filters),
        total: recentDeliveries.length,
        counts: {
            queued: recentDeliveries.filter(item => item.status === 'queued').length,
            sent: recentDeliveries.filter(item => item.status === 'sent').length,
            failed: recentDeliveries.filter(item => item.status === 'failed').length,
            skipped: recentDeliveries.filter(item => item.status === 'skipped').length,
            dryRun: recentDeliveries.filter(item => item.dryRun).length,
            live: recentDeliveries.filter(item => item.live).length,
            replay: recentDeliveries.filter(item => item.replay).length,
            retryable: recentDeliveries.filter(item => item.attempts.retryable).length,
        },
        recentDeliveries,
    }
}

function deliveryDestinationAvailability(attempt: DeliveryLedger[number]) {
    if (attempt.destinationId) {
        return {
            state: 'configured',
            code: null,
            label: null,
            type: null,
            status: null,
            message: 'Webhook destination is configured.',
            setupRoute: null,
            requestedDestinationId: null,
        }
    }

    const requestedDestination = attempt.redactedDestination.endpointHint === 'requested_destination_not_found'
    return {
        state: requestedDestination ? 'requested_destination_not_found' : 'missing_destination',
        code: 'destination_unavailable',
        label: requestedDestination ? 'Requested destination unavailable' : 'No webhook destination configured',
        type: 'webhook',
        status: 'unavailable',
        message: requestedDestination
            ? 'The requested webhook destination is not available for this organization. Choose an active destination or create one before retrying.'
            : 'No enabled webhook or Discord destination is configured for this organization. Create and test a destination before retrying.',
        setupRoute: 'POST /api/dwm/webhooks',
        requestedDestinationId: requestedDestination ? attempt.redactedDestination.endpointHash : null,
    }
}
