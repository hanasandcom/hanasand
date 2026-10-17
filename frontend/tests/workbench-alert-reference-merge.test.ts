import { strict as assert } from 'node:assert'
import test from 'node:test'
import { dwmAlertToWorkbenchCase } from '../src/app/dashboard/ti/workbench/alertAdapter'
import type { DwmAlert } from '../src/utils/dwm/product'

test('merges runtime capture and watchlist references by trimmed first-seen value', () => {
    const alert = {
        id: 'mixed-alert',
        severity: 'critical',
        confidence: 90,
        matchedTerm: { value: 'acme.com', kind: 'domain' },
        company: 'Acme',
        sourceFamily: 'telegram_public',
        firstSeenAt: '2026-06-29T10:00:00.000Z',
        evidence: [],
        watchlistIds: [' watch-first ', 7, '', 'watch-first', null],
        watchlistItemIds: [' item-first ', 0, 'item-first'],
        orgWatchlistScope: { watchlistIds: ['watch-second', 7, ' watch-third '], watchlistItemIds: ['item-second', 0, ' item-third '] },
        workflowContext: { watchlistIds: ['watch-first', 'watch-fourth'], watchlistItemIds: ['item-first', 'item-fourth'], captureIds: ['capture-second', ' capture-fourth '] },
        customerReadiness: { alertReadiness: { watchlistIds: ['watch-second', 'watch-fifth'], watchlistItemIds: ['item-second', 'item-fifth'], selectedCaptureIds: [' capture-first ', 17, '', 'capture-first'] } },
        deliveryReadinessContext: { selectedCaptureIds: ['capture-second', null, 17] },
        webhookContext: { selectedCaptureIds: [' capture-third '] },
        sourceProvenanceSummary: { captureIds: ['capture-first'], generationEvidenceWindow: { captureIds: ['capture-fifth'] } },
    } as unknown as DwmAlert
    const row = dwmAlertToWorkbenchCase(alert)
    const watchlistRow = row.timeline.find(item => item.id === 'mixed-alert_watchlist')
    const createdRow = row.timeline.find(item => item.id === 'mixed-alert_created')

    assert.equal(watchlistRow?.body, 'watch-first, 7, watch-second, watch-third, watch-fourth, watch-fifth / item-first, 0, item-second, item-third, item-fourth, item-fifth')
    assert.equal(createdRow?.body, 'acme.com matched 6 captures from telegram public.')
})
