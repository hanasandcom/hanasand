import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { queryOnce } from '../../src/utils/db.ts'
import {
    deliverDwmAlertNotification,
    listDwmWebhookDeliveries,
    listDwmWebhookReceiverReceipts,
    recordDwmWebhookReceiverReceipt,
    retryDwmWebhookDelivery,
    signDwmWebhookDeliveryBody,
} from '../../src/utils/dwm/webhooks.ts'
import {
    adminId, deliveryInput, destinationId, orgId, ownerId,
    payloadHash, receiverObservationPath, receiverReceivedAt, receiverUrl,
} from './support.ts'

export async function exerciseRetryLineage() {
    let lostAckNetworkAttempts = 0
    const lostAckSender = async (_endpoint: string, body: string) => {
        lostAckNetworkAttempts += 1
        const receiver = await recordDwmWebhookReceiverReceipt({
            eventId: 'receiver_pg_lost_ack',
            receivedAt: receiverReceivedAt,
            payload: JSON.parse(body),
            payloadBody: body,
            signature: signDwmWebhookDeliveryBody(body, receiverUrl),
        })
        assert.equal(receiver.ok, true)
        if (lostAckNetworkAttempts === 1) throw new Error('receiver acknowledgement lost')
        assert.equal(receiver.ok && receiver.created, false)
        return { status: 204, body: 'duplicate accepted' }
    }
    const [lostAckFailed] = await deliverDwmAlertNotification(ownerId, deliveryInput('lost_ack', false), lostAckSender)
    assert.equal(lostAckFailed.status, 'failed')
    const lostAckBeforeRetry = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_lost_ack',
    })
    assert.equal(lostAckBeforeRetry.length, 1)
    assert.equal(lostAckBeforeRetry[0].deliveryId, lostAckFailed.id)
    await queryOnce(`
        UPDATE dwm_webhook_deliveries
        SET next_retry_at = NOW() - INTERVAL '1 second'
        WHERE id = $1
    `, [lostAckFailed.id])
    const lostAckRetry = await retryDwmWebhookDelivery(adminId, orgId, lostAckFailed.id, lostAckSender)
    assert.equal(lostAckRetry.ok, true, JSON.stringify(lostAckRetry))
    assert.equal(lostAckRetry.ok && lostAckRetry.delivery.status, 'delivered')
    assert.equal(lostAckNetworkAttempts, 2)
    const lostAckAfterRetry = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_lost_ack',
    })
    assert.equal(lostAckAfterRetry.length, 1)
    assert.equal(lostAckAfterRetry[0].deliveryId, lostAckRetry.ok ? lostAckRetry.delivery.id : '')
    assert.equal(lostAckAfterRetry[0].payloadDeliveryId, lostAckFailed.id)

    let originalReceiverBody = ''
    const [failed] = await deliverDwmAlertNotification(ownerId, deliveryInput('restart', false), async (_endpoint, body) => {
        originalReceiverBody = body
        return { status: 503, body: 'receiver unavailable' }
    })
    assert.equal(failed.status, 'failed')
    assert.equal(failed.attemptCount, 1)
    assert.ok(failed.id)
    assert.ok(failed.idempotencyKey.includes(failed.payload.report.exportChecksum))
    assert.equal(failed.payloadHash, payloadHash(originalReceiverBody))
    let prematureNetworkAttempts = 0
    const premature = await retryDwmWebhookDelivery(adminId, orgId, failed.id, async () => {
        prematureNetworkAttempts += 1
        return { status: 204, body: 'must not be sent before due' }
    })
    assert.equal(premature.ok, false)
    assert.equal(premature.code, 'delivery_retry_not_ready')
    assert.equal(new Date(premature.nextRetryAt).toISOString(), new Date(failed.nextRetryAt).toISOString())
    assert.equal(prematureNetworkAttempts, 0)
    await queryOnce(`
        UPDATE dwm_webhook_deliveries
        SET next_retry_at = NOW() - INTERVAL '1 second'
        WHERE id = $1
    `, [failed.id])
    await writeFile(receiverObservationPath, JSON.stringify({
        body: originalReceiverBody,
        payloadHash: failed.payloadHash,
        idempotencyKey: failed.idempotencyKey,
        deliveryId: failed.id,
        prematureRetryBlocked: true,
    }))
    for (let index = 0; index < 101; index += 1) {
        const [generic] = await deliverDwmAlertNotification(ownerId, {
            ...deliveryInput(`generic_${index}`, true),
            alert: {
                ...deliveryInput(`generic_${index}`, true).alert,
                report: undefined,
            },
        })
        assert.equal(generic.status, 'dry_run')
    }
    const reportRowsPastLimit = await listDwmWebhookDeliveries(adminId, orgId, {
        alertId: 'report_pg_alert_restart',
        reportCaseId: 'case_restart',
        reportExportChecksum: failed.payload.report.exportChecksum,
    })
    assert.deepEqual(reportRowsPastLimit.map(row => row.id), [failed.id])
    return {
        persistedFailedDeliveryId: failed.id,
        nextRetryAt: failed.nextRetryAt,
        reportReceiptPastHundredRows: reportRowsPastLimit.length === 1,
        prematureRetryBlocked: prematureNetworkAttempts === 0,
        lostAckReceiptRebound: lostAckRetry.ok && lostAckAfterRetry[0].deliveryId === (lostAckRetry.ok ? lostAckRetry.delivery.id : ''),
        lostAckNetworkAttempts,
    }
}
