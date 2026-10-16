import crypto from 'node:crypto'
import { canonicalJson } from './customerOutputSafety.ts'
import { validateOutboundThirdPartyReport } from './thirdPartyReport.ts'
import {
    controlledReceiverUrls,
    hashValue as hashWebhookValue,
    signDwmWebhookDeliveryBody,
} from './webhookTransport.ts'
import { clean, firstClean, recordOrEmpty } from './webhookValueUtils.ts'

export function constantTimeEqual(expected: string, presented: string) {
    const expectedBytes = Buffer.from(expected)
    const presentedBytes = Buffer.from(presented)
    return expectedBytes.length > 0
        && expectedBytes.length === presentedBytes.length
        && crypto.timingSafeEqual(expectedBytes, presentedBytes)
}

export function validateDwmWebhookReceiverEnvelope(value: unknown) {
    const envelope = recordOrEmpty(value)
    const payload = recordOrEmpty(envelope.payload)
    const forwardedPayloadBody = typeof envelope.payloadBody === 'string' ? envelope.payloadBody : null
    if (forwardedPayloadBody !== null && Buffer.byteLength(forwardedPayloadBody) > 512 * 1024) {
        return { valid: false as const, error: 'Receiver payload exceeds the 512 KiB limit.' }
    }
    let payloadBody = canonicalJson(payload)
    if (forwardedPayloadBody !== null) {
        try {
            if (canonicalJson(recordOrEmpty(JSON.parse(forwardedPayloadBody))) !== payloadBody) {
                return { valid: false as const, error: 'Receiver serialized payload does not match its parsed payload.' }
            }
            payloadBody = forwardedPayloadBody
        } catch {
            return { valid: false as const, error: 'Receiver serialized payload must be valid JSON.' }
        }
    }
    const presentedSignature = clean(envelope.signature)
    const receiverUrl = controlledReceiverUrls().find(target =>
        constantTimeEqual(signDwmWebhookDeliveryBody(payloadBody, target), presentedSignature)
    )
    const nestedContext = recordOrEmpty(payload._hanasand)
    const context = Object.keys(nestedContext).length ? nestedContext : payload
    const org = recordOrEmpty(context.org)
    const destination = recordOrEmpty(context.destination)
    const delivery = recordOrEmpty(context.delivery)
    const alert = recordOrEmpty(context.alert)
    const eventType = clean(context.eventType)
    const orgId = firstClean(org.id, org.tenantId)
    const destinationId = clean(destination.id)
    const deliveryId = clean(delivery.id)
    const idempotencyKey = clean(context.idempotencyKey)
    const receivedAt = clean(envelope.receivedAt)
    const forwardedDeliveryId = clean(envelope.deliveryId)
    const forwardedIdempotencyKey = clean(envelope.idempotencyKey)

    if (!Object.keys(payload).length) return { valid: false as const, error: 'Receiver payload is required.' }
    if (!receiverUrl) {
        return { valid: false as const, error: 'Receiver payload signature is invalid.' }
    }
    if (clean(context.schemaVersion) !== 'dwm.webhook.v1') {
        return { valid: false as const, error: 'Receiver accepts only the canonical DWM webhook contract.' }
    }
    if (!orgId || !destinationId || !deliveryId || !eventType || !idempotencyKey) {
        return { valid: false as const, error: 'Receiver payload scope, destination, delivery, event type, and idempotency lineage are required.' }
    }
    if ((forwardedDeliveryId && forwardedDeliveryId !== deliveryId)
        || (forwardedIdempotencyKey && forwardedIdempotencyKey !== idempotencyKey)) {
        return { valid: false as const, error: 'Receiver delivery headers do not match the signed payload lineage.' }
    }
    if (!receivedAt || Number.isNaN(Date.parse(receivedAt))) {
        return { valid: false as const, error: 'Receiver timestamp must be valid.' }
    }

    const report = context.report
    const reportValidation = report === undefined
        ? { valid: true as const, report: undefined }
        : validateOutboundThirdPartyReport(report, {
            organizationId: orgId,
            alertId: alert.id,
        })
    if (!reportValidation.valid) {
        return { valid: false as const, error: reportValidation.error || 'Third-party report validation failed.' }
    }
    const reportPolicy = recordOrEmpty(reportValidation.report?.reportPolicy)
    const payloadHash = hashWebhookValue('payload', payloadBody)
    const receiptId = hashWebhookValue('receiver_receipt', canonicalJson({
        orgId,
        destinationId,
        idempotencyKey,
    }))

    return {
        valid: true as const,
        receipt: {
            id: receiptId,
            orgId,
            destinationId,
            deliveryId,
            eventType,
            idempotencyKey,
            payloadHash,
            receiverEndpointHash: hashWebhookValue('endpoint', receiverUrl),
            reportValidation: reportValidation.report ? 'valid' : 'not_applicable',
            reportCaseId: clean(reportPolicy.caseId) || null,
            reportAlertId: clean(reportPolicy.alertId) || clean(alert.id) || null,
            reportExportChecksum: clean(reportValidation.report?.exportChecksum) || null,
            receivedAt,
        },
    }
}
