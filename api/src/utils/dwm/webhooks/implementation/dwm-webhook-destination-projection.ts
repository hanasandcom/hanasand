import { idempotencyCoverage } from '../../webhookDeliveryUtilities.ts'
import { buildDwmWebhookDeliveryEvidenceProjection } from '../../webhookDeliveryEvidence.ts'
import { buildDwmWebhookDeliveryLedgerFromEvidence } from '../../webhookDeliveryLedger.ts'
import { buildDwmWebhookAuditEventContractsFromLedger } from '../../webhookAuditContracts.ts'
import { buildDwmWebhookDestinationContracts } from './destination-contracts.ts'
import { buildDwmWebhookDeliveryReadinessFromProjection } from './delivery-readiness-from-projection.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic } from './webhook-contract-types.ts'
import { auditEventIdForDelivery, destinationHealthAttempt } from './destination-health-attempt.ts'

export type DwmWebhookDestinationProjection = {
    destinationContracts: ReturnType<typeof buildDwmWebhookDestinationContracts>
    deliveryLedger: ReturnType<typeof buildDwmWebhookDeliveryLedgerFromEvidence>
    auditContracts: ReturnType<typeof buildDwmWebhookAuditEventContractsFromLedger>
    readiness: ReturnType<typeof buildDwmWebhookDeliveryReadinessFromProjection>
}

export function prepareDwmWebhookDestinationProjection({
    destinations,
    deliveries,
    auditEvents,
    liveDeliveryEnabled,
    now = new Date(),
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents: DwmWebhookAuditPublic[]
    liveDeliveryEnabled: boolean
    now?: Date
}): DwmWebhookDestinationProjection {
    const destinationContracts = buildDwmWebhookDestinationContracts({ destinations, deliveries, auditEvents })
    const projection = buildDwmWebhookDeliveryEvidenceProjection({ deliveries, auditEvents })
    const deliveryLedger = buildDwmWebhookDeliveryLedgerFromEvidence({ projection, now })
    const auditContracts = buildDwmWebhookAuditEventContractsFromLedger({
        auditEvents,
        deliveries,
        destinations,
        ledger: deliveryLedger,
    })
    const readiness = buildDwmWebhookDeliveryReadinessFromProjection({
        destinationContracts,
        deliveryLedger,
        liveDeliveryEnabled,
    })

    return { destinationContracts, deliveryLedger, auditContracts, readiness }
}

export function buildDwmWebhookDestinationHealthFromProjection({
    destinationContracts,
    deliveryLedger,
    auditContracts,
    readiness,
    liveDeliveryEnabled,
}: DwmWebhookDestinationProjection & { liveDeliveryEnabled: boolean }) {
    const readinessByDestination = new Map(readiness.destinations.map(item => [item.destinationId, item]))
    const auditByDestination = new Map<string, typeof auditContracts>()
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }
    const ledgerByDestination = new Map<string, typeof deliveryLedger>()
    for (const attempt of deliveryLedger) {
        if (!attempt.destinationId) continue
        const attempts = ledgerByDestination.get(attempt.destinationId) || []
        attempts.push(attempt)
        ledgerByDestination.set(attempt.destinationId, attempts)
    }

    return destinationContracts.map((destination) => {
        const attempts = (ledgerByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const audits = (auditByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const readinessRow = readinessByDestination.get(destination.id) || null
        const lastDryRun = attempts.find(attempt => attempt.dryRun) || null
        const lastFailure = attempts.find(attempt => attempt.rawStatus === 'failed' || attempt.errorClass) || null
        const lastLiveDisabled = attempts.find(attempt => attempt.errorClass === 'live_delivery_disabled') || null
        const latestAttempt = attempts[0] || null
        const lastTestAuditId = auditEventIdForDelivery(audits, destination.lastTest.requestId)
        const lastDeliveryAuditId = auditEventIdForDelivery(audits, destination.lastDelivery.requestId)

        return {
            schemaVersion: 'dwm.webhook.destination_health.v1',
            destinationId: destination.id,
            orgId: destination.orgId,
            owner: {
                ownerId: destination.createdBy,
                createdBy: destination.createdBy,
                actorId: destination.actorId,
            },
            type: destination.type,
            label: destination.label,
            status: destination.status,
            enabled: destination.enabled,
            health: readinessRow?.readiness || (destination.enabled ? 'blocked' : 'disabled'),
            ready: readinessRow?.ready || false,
            liveDeliveryEnabled,
            redactedEndpoint: destination.redactedDestination,
            blockers: readinessRow?.blockers || [],
            retry: readinessRow?.retryState || { retryable: false, nextRetryAt: null, errorClass: null, reason: 'no_attempts', attemptCount: 0 },
            lastDryRun: lastDryRun ? destinationHealthAttempt(lastDryRun, auditEventIdForDelivery(audits, lastDryRun.deliveryId)) : null,
            lastTest: {
                ...destination.lastTest,
                auditEventId: destination.lastTest.auditEventId || lastTestAuditId,
            },
            lastDelivery: {
                ...destination.lastDelivery,
                auditEventId: destination.lastDelivery.auditEventId || lastDeliveryAuditId,
            },
            lastFailure: lastFailure ? destinationHealthAttempt(lastFailure, auditEventIdForDelivery(audits, lastFailure.deliveryId)) : null,
            lastLiveDisabled: lastLiveDisabled ? destinationHealthAttempt(lastLiveDisabled, auditEventIdForDelivery(audits, lastLiveDisabled.deliveryId)) : null,
            latestAttempt: latestAttempt ? destinationHealthAttempt(latestAttempt, auditEventIdForDelivery(audits, latestAttempt.deliveryId)) : null,
            idempotencyCoverage: readinessRow?.idempotencyCoverage || idempotencyCoverage(attempts),
            recentAttempts: attempts.slice(0, 5).map(attempt => destinationHealthAttempt(attempt, auditEventIdForDelivery(audits, attempt.deliveryId))),
            auditEventIds: destination.auditEventIds,
            latestAuditEventId: destination.latestAuditEventId,
            auditEventContracts: audits.slice(0, 10),
            updatedAt: destination.updatedAt,
            createdAt: destination.createdAt,
        }
    })
}
