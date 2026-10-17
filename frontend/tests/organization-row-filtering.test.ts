import { expect, test } from 'bun:test'
import { filterRowsByQueryAndStatus } from '../src/app/organizations/model/filterRows'

test('organization rows combine case-insensitive status and text filters without reordering', () => {
    const rows = [
        { status: 'Admin', searchable: 'analyst alice' },
        { status: 'reader', searchable: 'analyst bob' },
        { status: 'admin', searchable: 'owner carol' },
    ]

    const visible = filterRowsByQueryAndStatus(rows, 'admin', 'analyst', row => row.status, row => row.searchable)

    expect(visible).toEqual([rows[0]])
})

test('organization rows show all statuses when no query or status filter is active', () => {
    const rows = [{ status: 'active', searchable: 'Acme' }, { status: 'paused', searchable: 'Example' }]

    expect(filterRowsByQueryAndStatus(rows, 'all', '', row => row.status, row => row.searchable)).toEqual(rows)
})
