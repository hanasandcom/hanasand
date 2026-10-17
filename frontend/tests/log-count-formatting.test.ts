import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { formatLogCount } from '../src/app/dashboard/logs/logPresentation'

test('log counts use the dashboard en-US grouping consistently', () => {
    assert.equal(formatLogCount(0), '0')
    assert.equal(formatLogCount(1234567), '1,234,567')
})
