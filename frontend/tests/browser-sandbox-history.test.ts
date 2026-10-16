import { strict as assert } from 'node:assert'
import test from 'node:test'
import { sanitizeHistory } from '../src/app/browser/historyData'

test('recent browser history keeps the newest duplicate target without discarding other URLs on that domain', () => {
    const history = sanitizeHistory([
        { id: 'first-vg', target: 'https://vg.no/first', network: 'regular', status: 'ended', startedAt: '2026-07-14T05:00:00.000Z' },
        { id: 'older-run', target: 'https://vg.no/latest', network: 'regular', status: 'ended', startedAt: '2026-07-14T05:30:00.000Z' },
        { id: 'example', target: 'https://example.com/', network: 'regular', status: 'ended', startedAt: '2026-07-14T05:45:00.000Z' },
        { id: 'latest-run', target: 'https://vg.no/latest', network: 'regular', status: 'ended', startedAt: '2026-07-14T06:00:00.000Z' },
    ])

    assert.deepEqual(history.map(run => run.id), ['latest-run', 'example', 'first-vg'])
})
