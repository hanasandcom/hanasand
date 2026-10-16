import { expect, test } from 'bun:test'
import { canonicalJson } from '../src/utils/dwm/customerOutputSafety.ts'
import { controlledReceiverUrl } from './fixtures/dwm-webhook-report-retry-env.ts'
import './fixtures/dwm-webhook-report-retry-setup.ts'
import { controlledReceiverEndpointHash, queries, receiverAudits, state } from './fixtures/dwm-webhook-report-retry-state.ts'
import { endpointHash, reportDeliveryPayload } from './fixtures/dwm-webhook-report-retry-data.ts'

test('persists one deterministic receiver receipt and builds report filters before the read limit', async () => {
    const {
        listDwmWebhookReceiverReceipts,
        recordDwmWebhookReceiverReceipt,
        signDwmWebhookDeliveryBody,
    } = await import('../src/utils/dwm/webhooks.ts')
    const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
    const previousReceiverUrls = process.env.DWM_CONTROLLED_RECEIVER_URLS
    const receiverUrl = controlledReceiverUrl
    process.env.TI_SCRAPER_SERVICE_TOKEN = 'receiver-signature-test'
    process.env.DWM_CONTROLLED_RECEIVER_URLS = receiverUrl
    const payload = reportDeliveryPayload()
    const envelope = {
        eventId: 'receiver_event_1',
        receivedAt: '2026-07-24T10:00:00.000Z',
        payload,
        signature: signDwmWebhookDeliveryBody(canonicalJson(payload), receiverUrl),
    }
    try {
        const first = await recordDwmWebhookReceiverReceipt(envelope)
        const duplicate = await recordDwmWebhookReceiverReceipt(envelope)
        expect(first).toMatchObject({
            ok: true,
            created: true,
            receipt: {
                orgId: 'org_1',
                destinationId: 'destination_1',
                deliveryId: null,
                payloadDeliveryId: 'delivery_receiver_1',
                reportValidation: 'valid',
                reportCaseId: 'case_1',
            },
        })
        expect(duplicate).toMatchObject({
            ok: true,
            created: false,
            receipt: { id: first.ok ? first.receipt.id : '' },
        })
        const conflictingPayload = { ...payload, alert: { ...payload.alert, title: 'different payload' } }
        const conflict = await recordDwmWebhookReceiverReceipt({
            ...envelope,
            payload: conflictingPayload,
            signature: signDwmWebhookDeliveryBody(canonicalJson(conflictingPayload), receiverUrl),
        })
        expect(conflict).toMatchObject({
            ok: false,
            status: 409,
            error: 'Receiver idempotency lineage already contains a different payload or target.',
        })
        state.receiverDestinationEndpointHash = endpointHash('https://external.example/report')
        const replayAfterRepoint = await recordDwmWebhookReceiverReceipt(envelope)
        expect(replayAfterRepoint).toMatchObject({
            ok: false,
            status: 409,
            error: 'Receiver destination no longer matches the signed controlled target.',
        })
        state.receiverDestinationEndpointHash = controlledReceiverEndpointHash
        state.receiverDestinationStatus = 'paused'
        const replayAfterPause = await recordDwmWebhookReceiverReceipt(envelope)
        expect(replayAfterPause).toMatchObject({
            ok: false,
            status: 409,
            error: 'Receiver destination no longer matches the signed controlled target.',
        })
        state.receiverDestinationStatus = 'active'
        state.receiverDestinationEndpointHash = endpointHash('https://external.example/report')
        const repointedPayload = {
            ...payload,
            idempotencyKey: `${payload.idempotencyKey}:repointed`,
            delivery: { ...payload.delivery, id: 'delivery_receiver_repointed' },
        }
        const repointed = await recordDwmWebhookReceiverReceipt({
            ...envelope,
            payload: repointedPayload,
            signature: signDwmWebhookDeliveryBody(canonicalJson(repointedPayload), receiverUrl),
        })
        expect(repointed).toMatchObject({
            ok: false,
            status: 404,
            error: 'Receiver destination is not active in the delivered organization scope.',
        })
        expect(receiverAudits).toHaveLength(1)
        const matchingReceipt = receiverAudits[0]
        receiverAudits.push(
            { ...matchingReceipt, id: 'receipt_other_destination', destination_id: 'destination_2' },
            { ...matchingReceipt, id: 'receipt_other_delivery', metadata: { ...matchingReceipt.metadata, deliveryId: 'delivery_2' } },
            { ...matchingReceipt, id: 'receipt_other_case', metadata: { ...matchingReceipt.metadata, reportCaseId: 'case_2' } },
            { ...matchingReceipt, id: 'receipt_other_checksum', metadata: { ...matchingReceipt.metadata, reportExportChecksum: 'checksum_2' } },
        )

        const receipts = await listDwmWebhookReceiverReceipts('org_1', {
            destinationId: 'destination_1',
            deliveryId: 'delivery_receiver_1',
            reportCaseId: 'case_1',
            reportExportChecksum: payload.report.exportChecksum,
        })
        expect(receipts).toHaveLength(1)
        expect(receipts.map(receipt => receipt.id)).toEqual([matchingReceipt.id])
        const query = queries.at(-1)
        expect(query?.params).toEqual([
            'org_1',
            'destination_1',
            'delivery_receiver_1',
            'case_1',
            payload.report.exportChecksum,
        ])
        expect(query?.sql.indexOf('metadata->>\'reportCaseId\' = $4')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
        expect(query?.sql.indexOf('metadata->>\'reportExportChecksum\' = $5')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
    } finally {
        if (previousToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
        else process.env.TI_SCRAPER_SERVICE_TOKEN = previousToken
        if (previousReceiverUrls === undefined) delete process.env.DWM_CONTROLLED_RECEIVER_URLS
        else process.env.DWM_CONTROLLED_RECEIVER_URLS = previousReceiverUrls
    }
})
