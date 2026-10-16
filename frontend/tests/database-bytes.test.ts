// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { formatDatabaseBytes } from '../src/utils/db/formatDatabaseBytes'

test('database byte values use decimal units and stable precision', () => {
    expect(formatDatabaseBytes(null)).toBe('—')
    expect(formatDatabaseBytes(Number.NaN)).toBe('—')
    expect(formatDatabaseBytes(0)).toBe('0 B')
    expect(formatDatabaseBytes(999)).toBe('999 B')
    expect(formatDatabaseBytes(1000)).toBe('1.00 KB')
    expect(formatDatabaseBytes(1_000_000)).toBe('1.00 MB')
})
