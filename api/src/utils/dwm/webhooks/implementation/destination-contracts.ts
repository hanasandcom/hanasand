import { redactDeliveryEvidenceText, redactNullableDeliveryText } from '../../webhookDeliveryUtilities.ts'
import { buildDwmWebhookDeliveryLedger } from '../../webhookDeliveryLedger.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic } from './webhook-contract-types.ts'
import { buildDwmWebhookDeliveryReadinessFromProjection } from './delivery-readiness-from-projection.ts'

export function buildDwmWebhookDestinationContracts({
    destinations,
    deliveries = [],
    auditEvents = [],
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
}) {
    return destinations.map((destination) => {
        const destinationDeliveries = deliveries
            .filter(delivery => delivery.destinationId === destination.id)
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const destinationAudits = auditEvents
            .filter(audit => audit.destinationId === destination.id)
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const lastTestDelivery = destinationDeliveries.find(delivery => delivery.eventType === 'dwm.alert.test')
        const lastDelivery = destinationDeliveries.find(delivery => delivery.eventType !== 'dwm.alert.test')
        const testAudit = lastTestDelivery ? destinationAudits.find(audit => audit.deliveryId === lastTestDelivery.id) : null
        const deliveryAudit = lastDelivery ? destinationAudits.find(audit => audit.deliveryId === lastDelivery.id) : null
        const failureReason = redactNullableDeliveryText(destination.lastTestError || lastDelivery?.error || lastTestDelivery?.error || null)
        const lastTestStatus = lastTestDelivery?.status || (destination.lastTestStatus === 'delivered' ? 'unknown' : destination.lastTestStatus || null)

        return {
            id: destination.id,
            orgId: destination.orgId,
            type: destination.kind,
            kind: destination.kind,
            label: destination.name,
            name: destination.name,
            display: {
                label: destination.name,
                channelLabel: destination.kind === 'discord' ? destination.name : null,
                destinationType: destination.kind,
                enabled: destination.status === 'active',
                status: destination.status,
            },
            status: destination.status,
            enabled: destination.status === 'active',
            events: destination.events,
            redactedUrl: redactDeliveryEvidenceText(destination.endpointHint),
            redactedDestination: {
                endpointHint: redactDeliveryEvidenceText(destination.endpointHint),
                endpointHash: destination.endpointHash,
            },
            createdBy: destination.createdBy,
            actorId: destination.createdBy,
            lastTest: {
                at: destination.lastTestedAt || lastTestDelivery?.attemptedAt || null,
                status: lastTestStatus,
                dryRun: lastTestDelivery?.dryRun ?? null,
                live: lastTestDelivery?.status === 'delivered' && lastTestDelivery.dryRun === false,
                httpStatus: destination.lastTestHttpStatus || lastTestDelivery?.responseStatus || null,
                failureReason: redactNullableDeliveryText(destination.lastTestError || lastTestDelivery?.error || null),
                requestId: lastTestDelivery?.id || null,
                auditEventId: testAudit?.id || null,
            },
            lastDelivery: {
                at: destination.lastDeliveryAt || lastDelivery?.attemptedAt || null,
                status: lastDelivery?.status || null,
                requestId: lastDelivery?.id || null,
                auditEventId: deliveryAudit?.id || null,
                failureReason: redactNullableDeliveryText(lastDelivery?.error || null),
            },
            failureReason,
            latestAuditEventId: destinationAudits[0]?.id || null,
            auditEventIds: destinationAudits.map(audit => audit.id),
            createdAt: destination.createdAt,
            updatedAt: destination.updatedAt,
        }
    })
}

export function buildDwmWebhookDeliveryReadiness({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const destinationContracts = buildDwmWebhookDestinationContracts({ destinations, deliveries, auditEvents })
    const deliveryLedger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    return buildDwmWebhookDeliveryReadinessFromProjection({
        destinationContracts,
        deliveryLedger,
        liveDeliveryEnabled,
    })
}
