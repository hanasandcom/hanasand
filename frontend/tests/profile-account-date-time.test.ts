import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAccountDateTime } from '../src/components/profile/formatAccountDateTime'

test('account activity dates keep the existing English medium date and short time format', () => {
    const value = '2026-10-17T12:34:00.000Z'
    const expected = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

    assert.equal(formatAccountDateTime(value), expected)
})
