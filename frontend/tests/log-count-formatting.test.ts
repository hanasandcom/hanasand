import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { formatLogCount } from '../src/app/dashboard/logs/logPresentation'
import { sampleTime, timeWindow } from '../src/app/dashboard/logs/throughputFormatting'

test('log counts use the dashboard en-US grouping consistently', () => {
    assert.equal(formatLogCount(0), '0')
    assert.equal(formatLogCount(1234567), '1,234,567')
})

test('throughput labels format samples and five-minute windows in en-US local time', () => {
    const value = '2026-10-17T12:05:00Z'
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    const end = new Date(value)
    const start = new Date(end.getTime() - 5 * 60_000)
    const formatTime = (date: Date) => date.toLocaleString('en-US', options)

    assert.equal(sampleTime(value), formatTime(end))
    assert.equal(timeWindow(value), `${formatTime(start)} – ${formatTime(end)}`)
})
