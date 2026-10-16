import type { CaseDetailPayload, AlertDetailPayload, WorkbenchApiPayload, WorkbenchDeliveryEvidence } from '../types'
import { stringValue } from './actionMessages'

export async function readCaseDetailJson(response: Response) {
    try {
        return await response.json() as CaseDetailPayload
    } catch {
        return { generatedAt: '', error: { message: 'Case detail response was not JSON.' } }
    }
}

export async function readAlertDetailJson(response: Response) {
    try {
        return await response.json() as AlertDetailPayload
    } catch {
        return { generatedAt: '', error: { message: 'Alert detail response was not JSON.' } }
    }
}

export async function readJson(response: Response) {
    try {
        return await response.json() as WorkbenchApiPayload
    } catch {
        return {}
    }
}

export function deliveryEvidenceFromPayload(payload: WorkbenchApiPayload | undefined, fallbackAlertId: string) {
    const attemptedAt = payload?.deliveredAt || payload?.testedAt || ''
    return deliveryCandidatesFromPayload(payload)
        .map(delivery => normalizeDeliveryEvidence(delivery, fallbackAlertId, attemptedAt))
        .filter((delivery): delivery is WorkbenchDeliveryEvidence => Boolean(delivery))
}

export function deliveryCandidatesFromPayload(payload: WorkbenchApiPayload | undefined): Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean } | undefined> {
    if (!payload) return []
    return [
        payload.delivery,
        payload.latestDelivery,
        ...(payload.deliveries || []),
        ...(payload.deliveryEvidence || []),
        payload.deliveryStatus?.latestDelivery,
        ...(payload.deliveryStatus?.deliveries || []),
        payload.deliveryProof?.latestDelivery,
        ...(payload.deliveryProof?.deliveries || []),
        payload.testResult?.delivery,
        ...(payload.testResult?.deliveries || []),
    ]
}

export function normalizeDeliveryEvidence(delivery: WorkbenchApiPayload['delivery'] | undefined, fallbackAlertId: string, fallbackAttemptedAt: string): WorkbenchDeliveryEvidence | undefined {
    const id = stringValue(delivery?.id)
    if (!id) return undefined
    return {
        id,
        alertId: stringValue(delivery?.alertId) || fallbackAlertId,
        status: stringValue(delivery?.status) || 'recorded',
        deliveryKind: stringValue(delivery?.deliveryKind),
        attemptedAt: stringValue(delivery?.attemptedAt) || fallbackAttemptedAt,
        webhookDestinationId: stringValue(delivery?.webhookDestinationId),
        endpointHash: stringValue(delivery?.endpointHash) || 'endpoint_hash_not_returned',
        payloadHash: stringValue(delivery?.payloadHash) || 'payload_hash_not_returned',
        httpStatus: typeof delivery?.httpStatus === 'number' ? delivery.httpStatus : undefined,
        error: stringValue(delivery?.error),
    }
}

export function mergeDeliveryEvidence(nextDeliveries: WorkbenchDeliveryEvidence[], existingDeliveries: WorkbenchDeliveryEvidence[]) {
    const seen = new Set<string>()
    const merged: WorkbenchDeliveryEvidence[] = []
    for (const delivery of [...nextDeliveries, ...existingDeliveries]) {
        if (seen.has(delivery.id)) continue
        seen.add(delivery.id)
        merged.push(delivery)
    }
    return merged
}
