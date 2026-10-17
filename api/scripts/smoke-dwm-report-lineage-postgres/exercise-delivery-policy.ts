import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { queryOnce } from '../../src/utils/db.ts'
import {
    deliverDwmAlertNotification,
    listDwmWebhookReceiverReceipts,
    recordDwmWebhookReceiverReceipt,
    signDwmWebhookDeliveryBody,
} from '../../src/utils/dwm/webhooks.ts'
import {
    adminId, deliveryInput, deliveryRows, destinationId, orgId, ownerId,
    receiverReceivedAt, receiverUrl, skippedDeliveryAudit,
} from './support.ts'

export async function exerciseDeliveryPolicy() {
    let concurrentNetworkAttempts = 0
    const concurrentInput = deliveryInput('concurrent', false)
    const concurrentSender = async (_endpoint: string, body: string) => {
        concurrentNetworkAttempts += 1
        await Bun.sleep(20)
        const receiver = await recordDwmWebhookReceiverReceipt({
            eventId: 'receiver_pg_concurrent',
            receivedAt: receiverReceivedAt,
            payload: JSON.parse(body),
            signature: signDwmWebhookDeliveryBody(body, receiverUrl),
        })
        assert.equal(receiver.ok && receiver.created, true)
        return { status: 204, body: 'accepted' }
    }
    const concurrent = await Promise.all([
        deliverDwmAlertNotification(ownerId, concurrentInput, concurrentSender),
        deliverDwmAlertNotification(adminId, concurrentInput, concurrentSender),
    ])
    assert.equal(concurrentNetworkAttempts, 1)
    assert.deepEqual(concurrent.flat().map(item => item.status).sort(), ['delivered', 'skipped'])
    const concurrentRows = await deliveryRows('report_pg_alert_concurrent')
    assert.equal(concurrentRows.filter(row => row.attempted_at).length, 1)
    assert.equal(new Set(concurrentRows.map(row => row.idempotency_key)).size, 1)
    assert.deepEqual(new Set(concurrentRows.map(row => row.owner_id)), new Set([ownerId, adminId]))
    const concurrentAttempt = concurrentRows.find(row => row.attempted_at)
    const concurrentSkipped = concurrentRows.find(row => row.status === 'skipped')
    assert.ok(concurrentAttempt && concurrentSkipped)
    const duplicateAudit = await skippedDeliveryAudit(concurrentSkipped.id)
    assert.equal(duplicateAudit.reason, 'duplicate_delivered_idempotency_key')
    assert.equal(duplicateAudit.priorDeliveryId, concurrentAttempt.id)
    assert.equal(duplicateAudit.priorDeliveredAt, concurrentAttempt.delivered_at)
    assert.equal(duplicateAudit.idempotencyKey, concurrentSkipped.idempotency_key)
    const concurrentReceipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_concurrent',
    })
    assert.equal(concurrentReceipts.length, 1)
    assert.equal(concurrentReceipts[0].payloadHash, concurrentAttempt?.payload_hash)
    assert.equal(concurrentReceipts[0].deliveryId, concurrentAttempt?.id)
    assert.equal(concurrentReceipts[0].payloadDeliveryId, concurrentAttempt?.id)

    await queryOnce('UPDATE dwm_webhook_destinations SET status = \'paused\' WHERE id = $1', [destinationId])
    let skippedNetworkAttempts = 0
    const selectionInput = deliveryInput('selection', true)
    const [selectionSkipped] = await deliverDwmAlertNotification(ownerId, selectionInput, async () => {
        skippedNetworkAttempts += 1
        return { status: 204, body: 'unexpected send' }
    })
    const selectionAudit = await skippedDeliveryAudit(selectionSkipped.id)
    assert.equal(selectionSkipped.status, 'skipped')
    assert.equal(selectionSkipped.destinationId, destinationId)
    assert.equal(selectionSkipped.dryRun, true)
    assert.equal(selectionSkipped.attemptCount, 0)
    assert.equal(selectionAudit.reason, 'disabled')
    assert.equal(selectionAudit.dryRun, true)
    assert.equal(selectionAudit.idempotencyKey, selectionSkipped.idempotencyKey)
    assert.equal(skippedNetworkAttempts, 0)
    await queryOnce('UPDATE dwm_webhook_destinations SET status = \'active\' WHERE id = $1', [destinationId])

    const missingDestinationId = `${destinationId}_missing`
    const missingInput = deliveryInput('missing_destination', true)
    missingInput.destinationId = missingDestinationId
    const [missingSkipped] = await deliverDwmAlertNotification(ownerId, missingInput, async () => {
        skippedNetworkAttempts += 1
        return { status: 204, body: 'unexpected send' }
    })
    const missingRow = (await deliveryRows('report_pg_alert_missing_destination'))[0]
    const missingAudit = await skippedDeliveryAudit(missingSkipped.id)
    assert.equal(missingSkipped.status, 'skipped')
    assert.equal(missingSkipped.destinationId, null)
    assert.equal(missingRow.destination_id, null)
    assert.equal(missingRow.endpoint_hint, 'requested_destination_not_found')
    assert.equal(missingRow.endpoint_hash, `endpoint_${createHash('sha256').update(missingDestinationId).digest('hex').slice(0, 32)}`)
    assert.equal(missingSkipped.attemptCount, 0)
    assert.equal(missingAudit.reason, 'requested_destination_not_found')
    assert.equal(missingAudit.requestedDestinationId, missingDestinationId)
    assert.equal(missingAudit.idempotencyKey, missingSkipped.idempotencyKey)
    assert.equal(skippedNetworkAttempts, 0)

    let budgetNetworkAttempts = 0
    const budgetSender = async () => {
        budgetNetworkAttempts += 1
        return { status: 503, body: 'retry later' }
    }
    for (const actor of [ownerId, adminId, ownerId]) {
        const [dryRun] = await deliverDwmAlertNotification(actor, deliveryInput('budget', true), budgetSender)
        assert.equal(dryRun.status, 'dry_run')
        assert.equal(dryRun.attemptCount, 0)
    }
    const budgetStatuses: string[] = []
    for (let index = 0; index < 6; index += 1) {
        const [delivery] = await deliverDwmAlertNotification(index % 2 ? adminId : ownerId, deliveryInput('budget', false), budgetSender)
        budgetStatuses.push(delivery.status)
    }
    assert.equal(budgetNetworkAttempts, 5)
    assert.deepEqual(budgetStatuses, ['failed', 'failed', 'failed', 'failed', 'failed', 'skipped'])
    const budgetRows = await deliveryRows('report_pg_alert_budget')
    assert.equal(budgetRows.filter(row => row.dry_run).length, 3)
    assert.equal(budgetRows.filter(row => row.attempted_at).length, 5)
    assert.equal(budgetRows.filter(row => row.status === 'skipped').length, 1)
    return {
        concurrentNetworkAttempts,
        concurrentStatuses: concurrent.flat().map(item => item.status).sort(),
        dryRuns: budgetRows.filter(row => row.dry_run).length,
        liveBudgetAttempts: budgetRows.filter(row => row.attempted_at).length,
        blockedAfterBudget: budgetStatuses.at(-1),
        durableReceiverReceipts: concurrentReceipts.length,
    }
}
