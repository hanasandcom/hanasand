// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { nextSort } from '../src/app/dashboard/db/databaseInventoryHelpers'

test('database sorting starts a new column ascending and toggles the active column', () => {
    expect(nextSort({ key: 'size', descending: true }, 'name')).toEqual({ key: 'name', descending: false })
    expect(nextSort({ key: 'name', descending: false }, 'name')).toEqual({ key: 'name', descending: true })
    expect(nextSort({ key: 'name', descending: true }, 'name')).toEqual({ key: 'name', descending: false })
})
