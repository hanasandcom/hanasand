import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { orderDeliveries } from '../src/app/dashboard/deliveryOrdering'

test('delivery ordering is newest first without mutating the input', () => {
    const rows = [
        { id: 'older', attemptedAt: '2026-01-01T00:00:00Z' },
        { id: 'newer', attemptedAt: '2026-02-01T00:00:00Z' },
        { id: 'missing-time' },
    ]

    const ordered = orderDeliveries(rows)

    assert.deepEqual(ordered.map(row => row.id), ['newer', 'older', 'missing-time'])
    assert.deepEqual(rows.map(row => row.id), ['older', 'newer', 'missing-time'])
})
