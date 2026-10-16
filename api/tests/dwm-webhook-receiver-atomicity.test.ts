import { expect, test } from 'bun:test'
import { enableLiveDelivery, controlledReceiverUrl } from './fixtures/dwm-webhook-report-retry-env.ts'
import './fixtures/dwm-webhook-report-retry-setup.ts'
import { controlledReceiverEndpointHash, ledger, receiverAudits, state } from './fixtures/dwm-webhook-report-retry-state.ts'
import { deliveryInput } from './fixtures/dwm-webhook-report-retry-data.ts'

test('commits a controlled delivery and exact receiver bind atomically', async () => {
    const {
        deliverDwmAlertNotification,
        recordDwmWebhookReceiverReceipt,
        signDwmWebhookDeliveryBody,
    } = await import('../src/utils/dwm/webhooks.ts')
    const restoreLiveDelivery = enableLiveDelivery()
    const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
    const previousReceiverUrls = process.env.DWM_CONTROLLED_RECEIVER_URLS
    process.env.TI_SCRAPER_SERVICE_TOKEN = 'receiver-signature-test'
    process.env.DWM_CONTROLLED_RECEIVER_URLS = controlledReceiverUrl
    state.destinationEndpointHash = controlledReceiverEndpointHash
    try {
        const sender = async (_endpoint: string, body: string) => {
            const payload = JSON.parse(body)
            const receipt = await recordDwmWebhookReceiverReceipt({
                eventId: payload.delivery.id,
                receivedAt: '2026-07-24T10:00:00.000Z',
                payload,
                payloadBody: body,
                signature: signDwmWebhookDeliveryBody(body, controlledReceiverUrl),
            })
            expect(receipt.ok).toBe(true)
            return { status: 202, body: '' }
        }
        const [delivery] = await deliverDwmAlertNotification('owner_1', deliveryInput('atomic_receipt', false), sender)
        expect(delivery.status).toBe('delivered')
        expect(receiverAudits).toHaveLength(1)
        expect(receiverAudits[0].delivery_id).toBe(delivery.id)

        ledger.length = 0
        receiverAudits.length = 0
        state.insertedDelivery = undefined
        state.failReceiptBind = true
        await expect(deliverDwmAlertNotification('owner_1', deliveryInput('atomic_rollback', false), sender))
            .rejects.toThrow('simulated receipt bind failure')
        expect(ledger).toHaveLength(0)
        expect(receiverAudits).toHaveLength(1)
        expect(receiverAudits[0].delivery_id).toBeNull()
    } finally {
        restoreLiveDelivery()
        if (previousToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
        else process.env.TI_SCRAPER_SERVICE_TOKEN = previousToken
        if (previousReceiverUrls === undefined) delete process.env.DWM_CONTROLLED_RECEIVER_URLS
        else process.env.DWM_CONTROLLED_RECEIVER_URLS = previousReceiverUrls
    }
})


test('moves a durable lost-ack receipt from the failed attempt to its exact delivered retry', async () => {
    const {
        deliverDwmAlertNotification,
        recordDwmWebhookReceiverReceipt,
        retryDwmWebhookDelivery,
        signDwmWebhookDeliveryBody,
    } = await import('../src/utils/dwm/webhooks.ts')
    const restoreLiveDelivery = enableLiveDelivery()
    const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
    const previousReceiverUrls = process.env.DWM_CONTROLLED_RECEIVER_URLS
    process.env.TI_SCRAPER_SERVICE_TOKEN = 'receiver-signature-test'
    process.env.DWM_CONTROLLED_RECEIVER_URLS = controlledReceiverUrl
    state.destinationEndpointHash = controlledReceiverEndpointHash
    let networkAttempts = 0
    const sender = async (_endpoint: string, body: string) => {
        networkAttempts += 1
        const payload = JSON.parse(body)
        const receipt = await recordDwmWebhookReceiverReceipt({
            eventId: payload.delivery.id,
            receivedAt: '2026-07-24T10:00:00.000Z',
            payload,
            payloadBody: body,
            signature: signDwmWebhookDeliveryBody(body, controlledReceiverUrl),
        })
        expect(receipt.ok).toBe(true)
        if (networkAttempts === 1) throw new Error('receiver acknowledgement lost')
        return { status: 202, body: '' }
    }
    try {
        const [failed] = await deliverDwmAlertNotification('owner_1', deliveryInput('lost_ack', false), sender)
        expect(failed).toMatchObject({
            status: 'failed',
            responseStatus: null,
            responseBody: null,
            error: 'receiver acknowledgement lost',
        })
        expect(receiverAudits[0]?.delivery_id).toBe(failed.id)
        const failedRow = ledger.find(row => row.id === failed.id)
        expect(failedRow).toBeDefined()
        failedRow!.next_retry_at = '2020-07-23T10:01:00.000Z'

        const retried = await retryDwmWebhookDelivery('member_2', 'org_1', failed.id, sender)
        expect(retried).toMatchObject({ ok: true, delivery: {
            status: 'delivered',
            attemptCount: 2,
            responseStatus: 202,
            responseBody: null,
            error: null,
        } })
        expect(networkAttempts).toBe(2)
        expect(receiverAudits).toHaveLength(1)
        expect(receiverAudits[0]?.delivery_id).toBe(retried.ok ? retried.delivery.id : '')
        expect(receiverAudits[0]?.metadata.deliveryId).toBe(failed.id)
    } finally {
        restoreLiveDelivery()
        if (previousToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
        else process.env.TI_SCRAPER_SERVICE_TOKEN = previousToken
        if (previousReceiverUrls === undefined) delete process.env.DWM_CONTROLLED_RECEIVER_URLS
        else process.env.DWM_CONTROLLED_RECEIVER_URLS = previousReceiverUrls
    }
})
