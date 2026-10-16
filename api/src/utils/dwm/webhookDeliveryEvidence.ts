import type { DwmWebhookDeliveryEvidenceFilters } from './webhooks.ts'
import { clean, recordOrEmpty } from './webhookValueUtils.ts'
import { toDwmWebhookAuditEvent, toDwmWebhookDelivery } from './webhookDestinationModels.ts'
import {
    dedupeFromIdempotencyKey,
    deliveryAttemptState,
    deliveryRetryFilterState,
    extractHanasandPayloadContext,
    parseCount,
    redactDeliveryEvidenceText,
    truncate,
} from './webhookDeliveryUtilities.ts'

type PublicDelivery = ReturnType<typeof toDwmWebhookDelivery>
type PublicAudit = ReturnType<typeof toDwmWebhookAuditEvent>

export function normalizeWebhookEvidenceFilters(filters: DwmWebhookDeliveryEvidenceFilters) {
    return {
        orgId: clean(filters.orgId) || null,
        destinationId: clean(filters.destinationId) || null,
        alertId: clean(filters.alertId) || null,
        casePath: clean(filters.casePath) || null,
        dedupeKey: clean(filters.dedupeKey) || null,
        requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
    }
}

export function normalizeWebhookOperationFilters(filters: DwmWebhookDeliveryEvidenceFilters) {
    const evidenceFilters = normalizeWebhookEvidenceFilters(filters)
    return {
        orgId: evidenceFilters.orgId,
        destinationId: evidenceFilters.destinationId,
        alertId: evidenceFilters.alertId,
        casePath: evidenceFilters.casePath,
        caseActionId: clean(filters.caseActionId) || null,
        caseActionPath: clean(filters.caseActionPath) || null,
        dedupeKey: evidenceFilters.dedupeKey,
        requestId: evidenceFilters.requestId,
        idempotencyKey: clean(filters.idempotencyKey) || null,
        action: clean(filters.action) || null,
        status: clean(filters.status) || null,
        timeFrom: clean(filters.timeFrom) || null,
        timeTo: clean(filters.timeTo) || null,
        retryState: clean(filters.retryState) || null,
        actorId: clean(filters.actorId) || null,
    }
}

export function buildDwmWebhookDeliveryEvidenceProjection({
    deliveries,
    auditEvents = [],
    filters = {},
}: {
    deliveries: PublicDelivery[]
    auditEvents?: PublicAudit[]
    filters?: DwmWebhookDeliveryEvidenceFilters
}) {
    const normalizedFilters = {
        ...normalizeWebhookOperationFilters(filters),
        reportCaseId: clean(filters.reportCaseId),
        reportExportChecksum: clean(filters.reportExportChecksum),
    }
    const auditByDelivery = new Map<string, PublicAudit>()
    for (const audit of auditEvents) {
        if (audit.deliveryId && !auditByDelivery.has(audit.deliveryId)) {
            auditByDelivery.set(audit.deliveryId, audit)
        }
    }

    const evidence = deliveries
        .map((delivery) => {
            const payloadContext = extractHanasandPayloadContext(delivery.payload)
            const payloadAlert = recordOrEmpty(payloadContext.alert)
            const payloadDelivery = recordOrEmpty(payloadContext.delivery)
            const payloadWatchlist = recordOrEmpty(payloadContext.watchlist)
            const audit = auditByDelivery.get(delivery.id) || null
            const dedupeKey = clean(payloadDelivery.dedupeKey)
                || clean(payloadAlert.dedupeKey)
                || dedupeFromIdempotencyKey(delivery.idempotencyKey)
            const casePath = delivery.casePath || clean(payloadDelivery.casePath) || clean(payloadAlert.casePath)
            const caseActionId = clean(payloadDelivery.caseActionId) || clean(payloadAlert.caseActionId)
            const caseActionPath = clean(payloadDelivery.caseActionPath) || clean(payloadAlert.caseActionPath)
            const replay = delivery.eventType === 'dwm.alert.replayed' || payloadDelivery.replay === true
            const liveRequested = !delivery.dryRun
            const live = liveRequested && delivery.status !== 'skipped'
            const retryState = deliveryRetryFilterState(delivery)

            return {
                requestId: delivery.id,
                deliveryId: delivery.id,
                orgId: delivery.orgId,
                destinationId: delivery.destinationId,
                alertId: delivery.alertId,
                eventType: delivery.eventType,
                status: delivery.status,
                dryRun: delivery.dryRun,
                live,
                liveRequested,
                replay,
                replayCount: parseCount(payloadAlert.replayCount),
                route: delivery.route || clean(payloadDelivery.route) || clean(payloadAlert.route),
                casePath,
                caseActionId,
                caseActionPath,
                dedupeKey,
                idempotencyKey: delivery.idempotencyKey,
                watchlistId: delivery.watchlistId || clean(payloadWatchlist.id),
                watchlistName: delivery.watchlistName || clean(payloadWatchlist.name),
                attemptedAt: delivery.attemptedAt,
                createdAt: delivery.createdAt,
                updatedAt: delivery.updatedAt || delivery.createdAt,
                redactedDestination: {
                    id: delivery.destinationId,
                    endpointHint: redactDeliveryEvidenceText(delivery.endpointHint),
                    endpointHash: delivery.endpointHash,
                },
                payloadHash: delivery.payloadHash,
                response: {
                    httpStatus: delivery.responseStatus,
                    summary: delivery.responseBody ? redactDeliveryEvidenceText(truncate(delivery.responseBody, 500)) : null,
                },
                error: delivery.error ? redactDeliveryEvidenceText(truncate(delivery.error, 500)) : null,
                auditEventId: audit?.id || delivery.auditEventId || null,
                auditAction: audit?.action || delivery.auditAction || null,
                actorId: audit?.actorId || delivery.auditActorId || null,
                reportValidation: delivery.reportValidation,
                reportExportChecksum: delivery.reportExportChecksum,
                reportCaseId: delivery.reportCaseId,
                thirdPartyReport: delivery.reportValidation === 'valid'
                    && Boolean(delivery.reportExportChecksum)
                    && Boolean(delivery.reportCaseId),
                retryState,
            }
        })
        .filter((item) => {
            if (normalizedFilters.orgId && item.orgId !== normalizedFilters.orgId) return false
            if (normalizedFilters.destinationId && item.destinationId !== normalizedFilters.destinationId) return false
            if (normalizedFilters.alertId && item.alertId !== normalizedFilters.alertId) return false
            if (normalizedFilters.casePath && item.casePath !== normalizedFilters.casePath) return false
            if (normalizedFilters.caseActionId && item.caseActionId !== normalizedFilters.caseActionId) return false
            if (normalizedFilters.caseActionPath && item.caseActionPath !== normalizedFilters.caseActionPath) return false
            if (normalizedFilters.dedupeKey && item.dedupeKey !== normalizedFilters.dedupeKey && item.idempotencyKey !== normalizedFilters.dedupeKey) return false
            if (normalizedFilters.requestId && item.requestId !== normalizedFilters.requestId && item.deliveryId !== normalizedFilters.requestId) return false
            if (normalizedFilters.idempotencyKey && item.idempotencyKey !== normalizedFilters.idempotencyKey) return false
            if (normalizedFilters.action && item.auditAction !== normalizedFilters.action && item.eventType !== normalizedFilters.action) return false
            if (normalizedFilters.status && item.status !== normalizedFilters.status && deliveryAttemptState(item.status, item.dryRun) !== normalizedFilters.status) return false
            if (normalizedFilters.retryState && item.retryState !== normalizedFilters.retryState) return false
            if (normalizedFilters.actorId && item.actorId !== normalizedFilters.actorId) return false
            if (normalizedFilters.reportCaseId && item.reportCaseId !== normalizedFilters.reportCaseId) return false
            if (normalizedFilters.reportExportChecksum && item.reportExportChecksum !== normalizedFilters.reportExportChecksum) return false
            if (normalizedFilters.timeFrom && String(item.attemptedAt || item.createdAt).localeCompare(normalizedFilters.timeFrom) < 0) return false
            if (normalizedFilters.timeTo && String(item.attemptedAt || item.createdAt).localeCompare(normalizedFilters.timeTo) > 0) return false
            return true
        })

    const deliveriesById = new Map<string, PublicDelivery>()
    const attemptCountsByIdempotencyKey = new Map<string, number>()
    for (const delivery of deliveries) {
        if (!deliveriesById.has(delivery.id)) deliveriesById.set(delivery.id, delivery)
        const key = delivery.idempotencyKey || delivery.id
        attemptCountsByIdempotencyKey.set(key, (attemptCountsByIdempotencyKey.get(key) || 0) + 1)
    }
    return { evidence, deliveriesById, attemptCountsByIdempotencyKey }
}

export function buildDwmWebhookDeliveryEvidence(input: {
    deliveries: PublicDelivery[]
    auditEvents?: PublicAudit[]
    filters?: DwmWebhookDeliveryEvidenceFilters
}) {
    return buildDwmWebhookDeliveryEvidenceProjection(input).evidence
}
