import { clean, recordOrEmpty } from './webhookValueUtils.ts'
import type { DwmAlertEventType } from './webhookDestinationTypes.ts'
import { toDwmWebhookAuditEvent, toDwmWebhookDelivery, toDwmWebhookDestination } from './webhookDestinationModels.ts'
import { buildDwmWebhookDeliveryLedger, buildDwmWebhookDeliveryLedgerFromEvidence } from './webhookDeliveryLedger.ts'
import { redactDeliveryEvidenceText, redactNullableDeliveryText, truncate } from './webhookDeliveryUtilities.ts'

type PublicDelivery = ReturnType<typeof toDwmWebhookDelivery>
type PublicAudit = ReturnType<typeof toDwmWebhookAuditEvent>
type PublicDestination = ReturnType<typeof toDwmWebhookDestination>
type DeliveryLedger = ReturnType<typeof buildDwmWebhookDeliveryLedgerFromEvidence>

export function buildDwmWebhookAuditEventContracts({
    auditEvents,
    deliveries = [],
    destinations = [],
}: {
    auditEvents: PublicAudit[]
    deliveries?: PublicDelivery[]
    destinations?: PublicDestination[]
}) {
    const ledger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    return buildDwmWebhookAuditEventContractsFromLedger({ auditEvents, deliveries, destinations, ledger })
}

export function buildDwmWebhookAuditEventContractsFromLedger({
    auditEvents,
    deliveries,
    destinations,
    ledger,
}: {
    auditEvents: PublicAudit[]
    deliveries: PublicDelivery[]
    destinations: PublicDestination[]
    ledger: DeliveryLedger
}) {
    const ledgerByDelivery = new Map(ledger.map(item => [item.deliveryId, item]))
    const deliveryById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))

    return [...auditEvents]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((audit) => {
            const delivery = audit.deliveryId ? deliveryById.get(audit.deliveryId) || null : null
            const ledgerEntry = audit.deliveryId ? ledgerByDelivery.get(audit.deliveryId) || null : null
            const destination = audit.destinationId ? destinationById.get(audit.destinationId) || null : null
            const metadata = redactAuditContractMetadata(recordOrEmpty(audit.metadata))
            const endpointHint = clean(destination?.endpointHint)
                || clean(delivery?.endpointHint)
                || clean(metadata.endpointHint)
            const endpointHash = clean(destination?.endpointHash)
                || clean(delivery?.endpointHash)
                || clean(metadata.endpointHash)

            return {
                schemaVersion: 'dwm.webhook.audit_event.v1',
                auditEventId: audit.id,
                eventId: audit.id,
                action: audit.action,
                category: webhookAuditCategory(audit.action),
                outcome: webhookAuditOutcome(audit.action, delivery?.status || clean(metadata.status)),
                severity: webhookAuditSeverity(audit.action, delivery?.status || clean(metadata.status)),
                actorId: audit.actorId,
                orgId: audit.orgId,
                destinationId: audit.destinationId,
                deliveryId: audit.deliveryId,
                requestId: audit.deliveryId,
                destination: audit.destinationId
                    ? {
                        id: audit.destinationId,
                        label: destination?.name || null,
                        type: destination?.kind || null,
                        status: destination?.status || null,
                        enabled: destination ? destination.status === 'active' : null,
                        redactedEndpoint: {
                            endpointHint: endpointHint ? redactDeliveryEvidenceText(endpointHint) : null,
                            endpointHash: endpointHash || null,
                        },
                    }
                    : null,
                delivery: delivery
                    ? {
                        alertId: delivery.alertId,
                        eventType: delivery.eventType,
                        status: delivery.status,
                        dryRun: delivery.dryRun,
                        live: !delivery.dryRun && delivery.status !== 'skipped',
                        idempotencyKey: delivery.idempotencyKey,
                        payloadHash: delivery.payloadHash,
                        responseStatus: delivery.responseStatus,
                        error: redactNullableDeliveryText(delivery.error),
                        watchlistId: delivery.watchlistId,
                        watchlistName: delivery.watchlistName,
                        route: delivery.route,
                        casePath: delivery.casePath,
                        attemptedAt: delivery.attemptedAt,
                        updatedAt: delivery.updatedAt || delivery.createdAt,
                    }
                    : null,
                retry: ledgerEntry
                    ? {
                        retryable: ledgerEntry.retryable,
                        nextRetryAt: ledgerEntry.nextRetryAt,
                        errorClass: ledgerEntry.errorClass,
                        reason: ledgerEntry.retryReason,
                        attemptCount: ledgerEntry.attemptCount,
                    }
                    : null,
                metadata,
                createdAt: audit.createdAt,
            }
        })
}

export function deliveryAuditActionForEvent(eventType: DwmAlertEventType) {
    if (eventType === 'dwm.alert.test') return 'delivery.tested'
    if (eventType === 'dwm.alert.replayed') return 'delivery.replayed'
    if (eventType === 'dwm.alert.updated') return 'delivery.updated'
    return 'delivery.created'
}

function webhookAuditCategory(action: string) {
    if (action.startsWith('destination.')) return 'destination'
    if (action.startsWith('delivery.')) return 'delivery'
    return 'webhook'
}

function webhookAuditOutcome(action: string, status?: string | null) {
    if (action === 'destination.created') return 'created'
    if (action === 'destination.updated') return 'updated'
    if (action === 'destination.archived') return 'disabled'
    if (action === 'delivery.created') return status || 'created'
    if (action === 'delivery.updated') return status || 'updated'
    if (action === 'delivery.tested') return 'tested'
    if (action === 'delivery.replayed') return status || 'replayed'
    if (action === 'delivery.retry_scheduled') return 'retry_scheduled'
    if (action === 'delivery.failed') return 'failed'
    if (action === 'delivery.delivered') return 'sent'
    if (action === 'delivery.skipped') return 'skipped'
    if (action === 'delivery.dry_run') return 'dry_run'
    return status || action.split('.').pop() || 'unknown'
}

function webhookAuditSeverity(action: string, status?: string | null) {
    const outcome = webhookAuditOutcome(action, status)
    if (outcome === 'failed') return 'error'
    if (outcome === 'skipped' || outcome === 'disabled') return 'warning'
    return 'info'
}

function redactAuditContractMetadata(metadata: Record<string, unknown>) {
    const redacted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(metadata)) {
        if (/endpoint|secret|token|password|credential|url/i.test(key) && key !== 'endpointHint') {
            redacted[key] = '[redacted]'
        } else if (typeof value === 'string') {
            redacted[key] = redactDeliveryEvidenceText(truncate(value, 1000))
        } else if (Array.isArray(value)) {
            redacted[key] = value.map(item => typeof item === 'string' ? redactDeliveryEvidenceText(truncate(item, 1000)) : item)
        } else if (value && typeof value === 'object') {
            redacted[key] = redactAuditContractMetadata(value as Record<string, unknown>)
        } else {
            redacted[key] = value
        }
    }
    return redacted
}
