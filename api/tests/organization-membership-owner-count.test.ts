import { expect, test } from 'bun:test'
import { activeOrganizationOwnerCount } from '../src/utils/organizationMemberships.ts'
import type run from '../src/utils/db.ts'

test('organization owner counts use active accounts that are not scheduled for deletion', async () => {
    let sql = ''
    let params: unknown[] = []
    const query: typeof run = async (statement, values = []) => {
        sql = statement
        params = values
        return { rows: [{ owner_count: '2' }], rowCount: 1 }
    }

    const count = await activeOrganizationOwnerCount('org-1', query)

    expect(count).toBe(2)
    expect(sql).toContain('owner.active IS TRUE')
    expect(sql).toContain('owner.deletion_scheduled_at IS NULL')
    expect(sql).toContain('membership.status = \'active\'')
    expect(sql).toContain('membership.role = \'owner\'')
    expect(params).toEqual(['org-1'])
})
