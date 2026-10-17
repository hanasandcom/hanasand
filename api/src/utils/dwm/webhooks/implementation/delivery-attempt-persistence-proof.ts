import type { DwmWebhookDispatchDestination } from '../dispatchPlanning.ts'
import { buildDwmWebhookDestinationTestPayloadPreview } from '../payloadPreviews.ts'
import type { DwmAlertNotificationInput } from '../../webhookDestinationTypes.ts'
import { clean } from '../../webhookValueUtils.ts'
import { redactDeliveryEvidenceText } from '../../webhookDeliveryUtilities.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic } from './webhook-contract-types.ts'
import { buildDwmWebhookDeliveryAttemptContract } from './delivery-attempt-contract.ts'

export function buildDwmWebhookDeliveryAttemptPersistenceProof({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: Array<DwmWebhookDispatchDestination | DwmWebhookDestinationPublic>
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const contract = buildDwmWebhookDeliveryAttemptContract({
        ownerId,
        input,
        destinations,
        deliveries,
        liveDeliveryEnabled,
    })
    const auditsByDeliveryId = new Map<string, DwmWebhookAuditPublic>()
    for (const audit of auditEvents) {
        const deliveryId = clean(audit.deliveryId)
        if (deliveryId) auditsByDeliveryId.set(deliveryId, audit)
    }
    const rows = contract.attempts.map((attempt) => {
        const persisted = [...deliveries].reverse().find(delivery =>
            delivery.orgId === attempt.orgId
            && delivery.idempotencyKey === attempt.idempotencyKey
            && (delivery.destinationId === attempt.destinationId || (!delivery.destinationId && attempt.status === 'skipped'))
        ) || null
        const audit = persisted ? auditsByDeliveryId.get(persisted.id) || null : null
        const persistedPreview = persisted?.payload ? buildDwmWebhookDestinationTestPayloadPreview(persisted.payload) : null
        return {
            destinationId: attempt.destinationId,
            orgId: attempt.orgId,
            alertId: attempt.alertId,
            eventType: attempt.eventType,
            expectedStatus: attempt.status,
            persisted: Boolean(persisted),
            persistedDeliveryId: persisted?.id || null,
            persistedStatus: persisted?.status || null,
            dryRun: persisted?.dryRun ?? attempt.dryRun,
            live: persisted ? !persisted.dryRun && persisted.status !== 'skipped' : attempt.live,
            replay: attempt.replay,
            dedupeKey: attempt.dedupeKey,
            idempotencyKey: attempt.idempotencyKey,
            payloadHash: persisted?.payloadHash || attempt.payloadHash,
            redactedDestination: {
                ...attempt.redactedDestination,
                endpointHash: persisted?.endpointHash || null,
                endpointHint: persisted?.endpointHint ? redactDeliveryEvidenceText(persisted.endpointHint) : null,
                endpointExposed: false,
            },
            sanitizedPayloadPreview: persistedPreview || attempt.sanitizedPayloadPreview,
            responseSummary: persisted?.responseBody || attempt.responseSummary,
            error: persisted?.error || attempt.error,
            retry: {
                attemptCount: persisted?.attemptCount ?? attempt.retry.attemptCount,
                retryable: persisted ? Boolean(persisted.nextRetryAt) : attempt.retry.retryable,
                nextRetryAt: persisted?.nextRetryAt || attempt.retry.nextRetryAt,
                errorClass: persisted?.errorClass || attempt.retry.errorClass,
                reason: persisted?.nextRetryAt ? 'retry_scheduled' : attempt.retry.reason,
            },
            audit: {
                expectedAction: attempt.audit.expectedAction,
                auditEventId: audit?.id || attempt.audit.auditEventId || null,
                action: audit?.action || null,
            },
            timestamps: {
                createdAt: persisted?.createdAt || attempt.timestamps.createdAt,
                updatedAt: persisted?.updatedAt || attempt.timestamps.updatedAt,
                attemptedAt: persisted?.attemptedAt || attempt.timestamps.attemptedAt,
            },
            blockers: persisted
                ? []
                : [{
                    code: 'delivery_attempt_not_persisted',
                    message: 'No persisted delivery row matched this expected destination and idempotency key.',
                    blocking: true,
                }],
        }
    })
    const missingPersisted = rows.filter(row => !row.persisted)
    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_persistence.v1',
        ok: contract.ok && missingPersisted.length === 0,
        ownerId,
        orgId: contract.orgId,
        eventType: contract.eventType,
        dryRun: contract.dryRun,
        noNetwork: contract.noNetwork,
        externalSendEnabled: contract.externalSendEnabled,
        requiredFields: contract.requiredFields,
        destinationSelection: contract.destinationSelection,
        totals: {
            expectedAttempts: contract.attempts.length,
            persistedAttempts: rows.filter(row => row.persisted).length,
            missingAttempts: missingPersisted.length,
            retryScheduled: rows.filter(row => row.retry.nextRetryAt).length,
            auditLinked: rows.filter(row => row.audit.auditEventId).length,
        },
        rows,
        blockers: [
            ...contract.blockers,
            ...missingPersisted.map(row => ({
                code: 'delivery_attempt_not_persisted',
                destinationId: row.destinationId,
                idempotencyKey: row.idempotencyKey,
                message: 'Expected delivery attempt has not been persisted yet.',
                blocking: true,
            })),
        ],
    }
}
