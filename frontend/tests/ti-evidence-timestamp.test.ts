import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { evidenceTimestamp } from '../src/utils/ti/search'

test('uses an evidence timestamp or a clear unavailable-date fallback', () => {
    assert.equal(evidenceTimestamp('2026-02-12T00:00:00.000Z'), '2026-02-12T00:00:00.000Z')
    assert.equal(evidenceTimestamp(undefined, '2025-09-02'), '2025-09-02')
    assert.equal(evidenceTimestamp(undefined, ''), 'Observation date unavailable')
})
