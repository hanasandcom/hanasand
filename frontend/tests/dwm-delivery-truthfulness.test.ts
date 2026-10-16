import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { workbenchSource } from './workbench-source'
import { deliverySummaryLabel, webhookReady } from '../src/app/dashboard/findings/case-format'
import type { DeliveryItem } from '../src/app/dashboard/findings/types'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'

test('DWM marks only durable webhook delivery as success', async () => {
    const root = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')
    const [deliveryPanel, deliveryActions, evidenceActions, workbench] = await Promise.all([
        readFile(path.join(root, 'src/app/dashboard/findings/delivery-panel.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/findings/workflow-delivery-actions.ts'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/findings/workflow-evidence-actions.ts'), 'utf8'),
        workbenchSource(root),
    ])

    assert.match(deliveryPanel, /lastSuccessfulDelivery = visible\.find\(delivery => delivery\.status === 'delivered' && delivery\.dryRun !== true\)/)
    assert.match(deliveryActions, /const deliveredCount = rows\.filter\(row => row\.status === 'delivered' && row\.dryRun !== true\)\.length/)
    assert.match(deliveryActions, /setResult\(\{ ok: !failed && deliveredCount > 0, message \}\)/)
    assert.match(deliveryActions, /Webhook delivery recorded a dry-run; no customer notification was sent\./)
    assert.doesNotMatch(deliveryActions, /setResult\(\{ ok: true, message: `Webhook delivery attempted/)
    assert.match(evidenceActions, /deliveryReady = rows\.some\(row => row\.status === 'delivered' && row\.dryRun !== true\)/)
    assert.match(evidenceActions, /ok: !webhookConfigured \|\| deliveryReady/)
    assert.match(workbench, /delivery\.status === 'delivered' \? 'ready'/)
    assert.doesNotMatch(workbench, /delivery\.status === 'delivered' \|\| delivery\.status === 'dry_run'/)

    const delivery = (status: string, dryRun = false): DeliveryItem => ({
        id: status, alertId: 'alert', endpointHash: 'hash', dedupeKey: status,
        attemptedAt: '2026-01-01T00:00:00Z', payloadHash: 'payload', status, dryRun,
    })
    assert.equal(deliverySummaryLabel([]), 'Not tested')
    assert.equal(deliverySummaryLabel([delivery('delivered')]), '1 delivered')
    assert.equal(deliverySummaryLabel([delivery('dry_run', true)]), '1 tested')
    assert.equal(deliverySummaryLabel([delivery('failed')]), '1 failed')
    assert.equal(deliverySummaryLabel([delivery('queued')]), '1 attempted')
    assert.equal(deliverySummaryLabel([delivery('delivered', true)]), '1 attempted')
    assert.equal(webhookReady('1 delivered'), true)
    assert.equal(webhookReady('1 tested'), true)
    assert.equal(webhookReady('1 attempted'), false)
})
