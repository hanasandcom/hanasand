import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { queryOnce } from '../../src/utils/db.ts'
import { canonicalJson } from '../../src/utils/dwm/customerOutputSafety.ts'
import {
    deliverDwmAlertNotification,
    listDwmWebhookDeliveries,
    listDwmWebhookReceiverReceipts,
    recordDwmWebhookReceiverReceipt,
    retryDwmWebhookDelivery,
    signDwmWebhookDeliveryBody,
} from '../../src/utils/dwm/webhooks.ts'
import {
    adminId, database, deliveryInput, deliveryRows, destinationId, orgId, ownerId,
    receiverObservationPath, receiverReceivedAt, receiverUrl,
} from './support.ts'

export async function verifyAfterRestart(phase: string) {
    const lostAckReceipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_lost_ack',
    })
    assert.equal(lostAckReceipts.length, 1)
    const lostAckRows = await deliveryRows('report_pg_alert_lost_ack')
    const lostAckDelivered = lostAckRows.find(row => row.status === 'delivered')
    assert.ok(lostAckDelivered)
    assert.equal(lostAckReceipts[0].deliveryId, lostAckDelivered.id)
    assert.equal(lostAckRows.filter(row => row.attempted_at).length, 2)

    const persistedReceiverReceipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_concurrent',
    })
    assert.equal(persistedReceiverReceipts.length, 1)
    const concurrentRowsBeforeReplay = await deliveryRows('report_pg_alert_concurrent')
    const concurrentPayload = concurrentRowsBeforeReplay.find(row => row.attempted_at)?.payload
    const replayedReceiver = await recordDwmWebhookReceiverReceipt({
        eventId: 'receiver_pg_concurrent',
        receivedAt: receiverReceivedAt,
        payload: concurrentPayload,
        signature: signDwmWebhookDeliveryBody(canonicalJson(concurrentPayload), receiverUrl),
    })
    assert.equal(replayedReceiver.ok, true)
    assert.equal(replayedReceiver.ok && replayedReceiver.created, false)

    const priorResult = await queryOnce(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE org_id = $1
          AND alert_id = 'report_pg_alert_restart'
          AND status = 'failed'
          AND attempted_at IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
    `, [orgId])
    const prior = priorResult.rows[0]
    assert.ok(prior, 'Exercise phase did not persist the failed report delivery.')
    const receiverObservation = JSON.parse(await readFile(receiverObservationPath, 'utf8')) as {
        body: string
        payloadHash: string
        idempotencyKey: string
        deliveryId: string
        prematureRetryBlocked: boolean
    }
    const storedPayload = canonicalJson(prior.payload)
    const storedIdempotencyKey = prior.idempotency_key
    assert.equal(prior.id, receiverObservation.deliveryId)
    assert.equal(storedPayload, receiverObservation.body)
    assert.equal(prior.payload_hash, receiverObservation.payloadHash)
    assert.equal(prior.idempotency_key, receiverObservation.idempotencyKey)
    const reportRowsPastLimit = await listDwmWebhookDeliveries(adminId, orgId, {
        alertId: 'report_pg_alert_restart',
        reportCaseId: 'case_restart',
        reportExportChecksum: prior.payload.report.exportChecksum,
    })
    assert.deepEqual(reportRowsPastLimit.map(row => row.id), [prior.id])
    const retryDelayMs = Math.max(0, new Date(prior.next_retry_at).getTime() - Date.now())
    if (retryDelayMs) await Bun.sleep(retryDelayMs + 50)
    const sentBodies: string[] = []

    const retried = await retryDwmWebhookDelivery(adminId, orgId, prior.id, async (_endpoint, body) => {
        sentBodies.push(body)
        const receiver = await recordDwmWebhookReceiverReceipt({
            eventId: 'receiver_pg_restart',
            receivedAt: '2026-07-24T10:05:00.000Z',
            payload: JSON.parse(body),
            signature: signDwmWebhookDeliveryBody(body, receiverUrl),
        })
        assert.equal(receiver.ok && receiver.created, true)
        return { status: 204, body: 'accepted after restart' }
    })
    assert.equal(retried.ok, true, JSON.stringify(retried))
    assert.deepEqual(sentBodies, [receiverObservation.body])
    assert.equal(retried.delivery.payloadHash, receiverObservation.payloadHash)
    assert.equal(retried.delivery.idempotencyKey, storedIdempotencyKey)
    assert.equal(retried.delivery.ownerId, ownerId)
    assert.equal(retried.delivery.auditActorId, adminId)
    assert.equal(retried.delivery.attemptCount, 2)
    assert.deepEqual(retried.delivery.payload, prior.payload)
    const restartReceipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_restart',
    })
    assert.equal(restartReceipts.length, 1)
    assert.equal(restartReceipts[0].deliveryId, retried.delivery.id)
    assert.equal(restartReceipts[0].payloadDeliveryId, prior.id)
    assert.equal(restartReceipts[0].payloadHash, prior.payload_hash)

    let duplicateNetworkAttempts = 0
    const [duplicate] = await deliverDwmAlertNotification(ownerId, deliveryInput('restart', false), async () => {
        duplicateNetworkAttempts += 1
        return { status: 204, body: 'duplicate must not reach receiver' }
    })
    assert.equal(duplicate.status, 'skipped')
    assert.equal(duplicateNetworkAttempts, 0)
    assert.equal((await listDwmWebhookReceiverReceipts(orgId, {
        destinationId,
        reportCaseId: 'case_restart',
    })).length, 1)

    const restartRows = await deliveryRows('report_pg_alert_restart')
    const attemptedRestartRows = restartRows.filter(row => row.attempted_at)
    assert.equal(attemptedRestartRows.length, 2)
    assert.equal(restartRows.filter(row => row.status === 'delivered').length, 1)
    assert.equal(new Set(restartRows.map(row => row.idempotency_key)).size, 1)
    assert.ok(attemptedRestartRows.every(row => canonicalJson(row.payload) === receiverObservation.body))
    assert.ok(attemptedRestartRows.every(row => row.payload_hash === receiverObservation.payloadHash))

    const budgetRows = await deliveryRows('report_pg_alert_budget')
    assert.equal(budgetRows.filter(row => row.dry_run).length, 3)
    assert.equal(budgetRows.filter(row => row.attempted_at).length, 5)
    assert.equal(budgetRows.filter(row => row.status === 'skipped').length, 1)

    const concurrentRows = await deliveryRows('report_pg_alert_concurrent')
    assert.equal(concurrentRows.filter(row => row.attempted_at).length, 1)

    console.log(JSON.stringify({
        phase,
        database,
        restartReconnect: true,
        retriedDeliveryId: retried.delivery.id,
        priorDeliveryId: prior.id,
        exactOriginalReceiverBody: sentBodies[0] === receiverObservation.body,
        exactOriginalReceiverPayloadHash: retried.delivery.payloadHash === receiverObservation.payloadHash,
        prematureRetryBlocked: receiverObservation.prematureRetryBlocked,
        reportReceiptPastHundredRows: reportRowsPastLimit.length === 1,
        durableReceiverReceiptAfterRestart: persistedReceiverReceipts.length === 1,
        retryReceiptBoundToAuthoritativeDelivery: restartReceipts[0].deliveryId === retried.delivery.id,
        lostAckReceiptSurvivedRestart: lostAckReceipts[0].deliveryId === lostAckDelivered.id,
        duplicateNetworkAttempts,
        receiverReplayCreatedDuplicate: replayedReceiver.ok && replayedReceiver.created,
        exactIdempotencyLineage: retried.delivery.idempotencyKey === storedIdempotencyKey,
        retryActorAuditOnly: retried.delivery.ownerId === ownerId && retried.delivery.auditActorId === adminId,
        concurrentActualAttempts: concurrentRows.filter(row => row.attempted_at).length,
        dryRunsOutsideBudget: budgetRows.filter(row => row.dry_run).length,
        maximumActualAttempts: budgetRows.filter(row => row.attempted_at).length,
    }, null, 2))
}
