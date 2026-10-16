import type { WebhookDestination, DeliveryRow, DeliveryPayloadPreviewData } from '../types/delivery'
import { sanitizeOrganizationDisplayCopy } from './textSafety'
import { arrayValue, cleanString, objectValue, numberValue, booleanValue } from './labels'

export function deliveriesForDestination(destination: WebhookDestination, deliveries: DeliveryRow[]) {
    return deliveries.filter(delivery => deliveryDestinationIds(delivery, [destination]).includes(destination.id))
}

export function deliveryWatchlistId(delivery: DeliveryRow) {
    return delivery.watchlistItemId || delivery.watchlistId || delivery.watchlistItemIds?.[0] || delivery.watchlistIds?.[0] || ''
}

export function deliveryDestinationIds(delivery: DeliveryRow, destinations: WebhookDestination[]) {
    return [
        delivery.webhookDestinationId,
        delivery.destinationId,
        ...destinations
            .filter(destination => (destination.endpointHash && destination.endpointHash === delivery.endpointHash) || (destination.endpointHint && destination.endpointHint === delivery.endpointHint))
            .map(destination => destination.id),
    ].filter(Boolean) as string[]
}

export function matchReasonForRecord(id: string, deliveries: DeliveryRow[]) {
    const delivery = deliveries.find(item => item.alertId === id || item.caseId === id)
    return sanitizeOrganizationDisplayCopy(delivery ? payloadPreviewForDelivery(delivery)?.context?.matchReason : undefined)
}

export function normalizedDeliveryRows(payload: Record<string, unknown>): DeliveryRow[] {
    const rawRows = arrayValue<DeliveryRow>(payload.deliveries ?? payload.items ?? payload.results)
    const ledgerRows = arrayValue<Record<string, unknown>>(payload.deliveryLedger)
    const evidenceRows = arrayValue<Record<string, unknown>>(payload.deliveryEvidence)
    const enrichedById = new Map<string, Record<string, unknown>>()

    for (const row of [...evidenceRows, ...ledgerRows]) {
        const id = cleanString(row.deliveryId) || cleanString(row.requestId) || cleanString(row.id)
        if (!id) continue
        enrichedById.set(id, { ...(enrichedById.get(id) || {}), ...row })
    }

    return rawRows.map((row) => {
        const id = row.id || row.requestId || ''
        const enriched = id ? enrichedById.get(id) || {} : {}
        const response = objectValue(enriched.response) || {}
        const redactedDestination = objectValue(enriched.redactedDestination) || {}
        return {
            ...row,
            id: row.id || cleanString(enriched.deliveryId) || cleanString(enriched.requestId) || id,
            requestId: row.requestId || cleanString(enriched.requestId) || cleanString(enriched.deliveryId),
            auditEventId: row.auditEventId || cleanString(enriched.auditEventId),
            auditAction: row.auditAction || cleanString(enriched.auditAction),
            organizationId: row.organizationId || row.orgId || cleanString(enriched.orgId),
            alertId: row.alertId || cleanString(enriched.alertId),
            caseId: row.caseId || cleanString(enriched.caseId),
            watchlistId: row.watchlistId || cleanString(enriched.watchlistId),
            watchlistName: row.watchlistName || cleanString(enriched.watchlistName),
            webhookDestinationId: row.webhookDestinationId || row.destinationId || cleanString(enriched.destinationId),
            endpointHash: row.endpointHash || cleanString(enriched.endpointHash) || cleanString(redactedDestination.endpointHash),
            endpointHint: row.endpointHint || cleanString(enriched.redactedEndpointLabel) || cleanString(redactedDestination.endpointHint),
            status: row.status || cleanString(enriched.status) || cleanString(enriched.rawStatus),
            httpStatus: row.httpStatus ?? row.responseStatus ?? numberValue(enriched.responseStatus) ?? numberValue(response.httpStatus),
            attemptedAt: row.attemptedAt || cleanString(enriched.attemptedAt),
            createdAt: row.createdAt || cleanString(enriched.createdAt),
            updatedAt: row.updatedAt || cleanString(enriched.updatedAt),
            dryRun: row.dryRun ?? booleanValue(enriched.dryRun),
            error: row.error || cleanString(enriched.error),
            errorClass: row.errorClass || cleanString(enriched.errorClass),
            responseSummary: row.responseSummary || row.responseBody || cleanString(enriched.responseSummary) || cleanString(response.summary),
            dedupeKey: row.dedupeKey || row.idempotencyKey || cleanString(enriched.dedupeKey) || cleanString(enriched.idempotencyKey),
            casePath: row.casePath || cleanString(enriched.casePath),
            payload: row.payload || objectValue(enriched.payload) || undefined,
            attemptCount: row.attemptCount ?? numberValue(enriched.attemptCount),
            retryCount: row.retryCount ?? numberValue(enriched.retryCount),
            nextRetryAt: row.nextRetryAt ?? cleanString(enriched.nextRetryAt) ?? null,
            payloadPreview: payloadPreviewForDelivery(row)
                || payloadPreviewFromRecord(enriched.sanitizedPayloadPreview)
                || payloadPreviewFromRecord(enriched.payloadPreview),
        }
    })
}

export function payloadPreviewForDelivery(delivery: DeliveryRow): DeliveryPayloadPreviewData | null {
    const direct = payloadPreviewFromRecord(delivery.sanitizedPayloadPreview)
        || payloadPreviewFromRecord(delivery.payloadPreview)
    if (direct) return direct
    return payloadPreviewFromPayload(delivery.payload, delivery)
}

export function payloadPreviewFromRecord(value: unknown): DeliveryPayloadPreviewData | null {
    const record = objectValue(value)
    if (!record) return null
    const context = objectValue(record.context) || {}
    const fields = arrayValue<Record<string, unknown>>(record.fields).map(field => ({
        name: cleanString(field.name),
        valuePreview: cleanString(field.valuePreview) || cleanString(field.value),
        inline: booleanValue(field.inline),
    })).filter(field => field.name || field.valuePreview)
    return {
        title: cleanString(record.title),
        contentPreview: cleanString(record.contentPreview) || cleanString(record.content),
        descriptionPreview: cleanString(record.descriptionPreview) || cleanString(record.description),
        fieldNames: arrayValue<unknown>(record.fieldNames).map(cleanString).filter((item): item is string => Boolean(item)),
        fields,
        payloadHash: cleanString(record.payloadHash),
        context: {
            orgName: cleanString(context.orgName),
            orgId: cleanString(context.orgId),
            alertTitle: cleanString(context.alertTitle),
            alertId: cleanString(context.alertId),
            severity: cleanString(context.severity),
            sourceFamily: cleanString(context.sourceFamily),
            evidenceCount: numberValue(context.evidenceCount) ?? null,
            evidenceTimestamp: cleanString(context.evidenceTimestamp),
            watchlistName: cleanString(context.watchlistName),
            watchlistId: cleanString(context.watchlistId),
            matchReason: cleanString(context.matchReason),
            deliveryState: cleanString(context.deliveryState),
            casePath: cleanString(context.casePath),
            alertUrl: cleanString(context.alertUrl),
        },
    }
}

export function payloadPreviewFromPayload(payload: unknown, delivery: DeliveryRow): DeliveryPayloadPreviewData | null {
    const record = objectValue(payload)
    if (!record) return null
    const embeds = arrayValue<Record<string, unknown>>(record.embeds)
    const embed = embeds[0] || {}
    const fields = arrayValue<Record<string, unknown>>(embed.fields).map(field => ({
        name: cleanString(field.name),
        valuePreview: cleanString(field.value),
        inline: booleanValue(field.inline),
    })).filter(field => field.name || field.valuePreview)
    if (!fields.length && !cleanString(embed.title) && !cleanString(embed.description) && !cleanString(record.content)) return null
    const fieldValue = (name: string) => fields.find(field => field.name?.toLowerCase() === name.toLowerCase())?.valuePreview
    return {
        title: cleanString(embed.title) || delivery.alertId || null,
        contentPreview: cleanString(record.content) || null,
        descriptionPreview: cleanString(embed.description) || null,
        fieldNames: fields.map(field => field.name).filter((item): item is string => Boolean(item)),
        fields,
        payloadHash: delivery.payloadHash || null,
        context: {
            orgName: fieldValue('Organization') || delivery.organizationId || delivery.orgId || null,
            alertTitle: cleanString(embed.title) || null,
            alertId: delivery.alertId || null,
            severity: fieldValue('Severity') || null,
            sourceFamily: fieldValue('Source family') || null,
            evidenceCount: numberValue(Number(fieldValue('Evidence count'))) ?? null,
            evidenceTimestamp: fieldValue('Evidence timestamp') || fieldValue('Observed at') || null,
            watchlistName: fieldValue('Watchlist') || delivery.watchlistName || deliveryWatchlistId(delivery) || null,
            watchlistId: deliveryWatchlistId(delivery) || null,
            matchReason: fieldValue('Match reason') || null,
            deliveryState: fieldValue('Delivery state') || delivery.status || null,
            casePath: fieldValue('Case') || delivery.casePath || null,
            alertUrl: fieldValue('Alert URL') || null,
        },
    }
}

export function deliveryTime(delivery: DeliveryRow) {
    const value = delivery.attemptedAt || delivery.updatedAt || delivery.createdAt || ''
    const time = Date.parse(value)
    return Number.isFinite(time) ? time : 0
}
