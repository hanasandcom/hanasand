// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueueRow, RecordDetail } from '../src/app/dashboard/ti/timeliness/TimelinessRecords'
import { date } from '../src/app/dashboard/ti/timeliness/data'
import type { Item, ReferenceForm } from '../src/app/dashboard/ti/timeliness/types'

const form: ReferenceForm = { role: 'actor', timestamp: '', referenceUrl: '', referenceTitle: '', evidencePath: '' }

function renderRecovery(item: Item) {
    return [
        renderToStaticMarkup(createElement(QueueRow, { item, active: false, onClick: () => {} })),
        renderToStaticMarkup(createElement(RecordDetail, { item, form, setForm: () => {}, saving: false, onSubmit: () => {} })),
    ]
}

function recoveryItem(status: NonNullable<Item['reportRecovery']>['status']): Item {
    return {
        id: 'record-1', incidentId: 'incident-1', captureId: 'capture-1', sourceId: 'source-1',
        title: 'Example incident', status: 'unresolved_reference', missingStages: ['first_report'],
        reportRecovery: { status, attempts: 2, reason: 'Publisher page is unavailable.', nextAttemptAt: '2026-10-17T12:00:00Z' },
        stages: {}, provenance: {}, reportReferences: [], latencies: {}, timestampAnomalies: [],
    }
}

test('queue and record detail render the same failed report recovery guidance', () => {
    const item = recoveryItem('failed')
    const [queue, detail] = renderRecovery(item)
    const lookup = '<div class="border-b border-ui-border px-3 py-2 text-xs text-ui-muted">Report lookup: Retry scheduled · 2 attempts<p class="mt-1">Publisher page is unavailable.</p><p class="mt-1">Next attempt:'
    const nextAttempt = `Next attempt: ${date(item.reportRecovery!.nextAttemptAt!)}`

    expect(queue).toContain(lookup)
    expect(detail).toContain(lookup)
    expect(queue).toContain(nextAttempt)
    expect(detail).toContain(nextAttempt)
    expect(queue).toContain('Example incident')
    expect(detail).toContain('Persisted event path')
})

test('running report recovery keeps its status and reason but hides the next attempt', () => {
    const [queue, detail] = renderRecovery(recoveryItem('running'))

    for (const markup of [queue, detail]) {
        expect(markup).toContain('Report lookup: Collecting evidence · 2 attempts')
        expect(markup).toContain('Publisher page is unavailable.')
        expect(markup).not.toContain('Next attempt:')
    }
})
