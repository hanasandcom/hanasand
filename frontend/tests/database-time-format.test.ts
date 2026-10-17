import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDatabaseTime } from '../src/app/dashboard/db/formatDatabaseTime'

test('database sample times stay in the shared UTC clock format', () => {
    assert.equal(formatDatabaseTime('2026-10-17T12:34:00.000Z'), '12:34 UTC')
})
