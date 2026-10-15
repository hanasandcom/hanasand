import { expect, test } from 'bun:test'
import { activeOrganizationOwnerCount } from '../src/utils/organizationMemberships.ts'
import { updateActiveOrganizationMemberRole, type IdentityQuery } from '../src/utils/db/identityDataWrites.ts'
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

test('active member role update and organization timestamp share one domain write', async () => {
    const calls: Array<{ sql: string, params: unknown[] }> = []
    const query: IdentityQuery = async (sql, params = []) => {
        calls.push({ sql, params })
        return calls.length === 1
            ? { rows: [{ organization_id: 'org-1', user_id: 'member-1', role: 'reader', status: 'active' }], rowCount: 1 }
            : { rows: [], rowCount: 1 }
    }

    const member = await updateActiveOrganizationMemberRole({
        organizationId: 'org-1',
        userId: 'member-1',
        role: 'reader',
    }, query)

    expect(member).toMatchObject({ user_id: 'member-1', role: 'reader', status: 'active' })
    expect(calls).toHaveLength(2)
    expect(calls[0].sql).toContain('status = \'active\'')
    expect(calls[0].params).toEqual(['org-1', 'member-1', 'reader'])
    expect(calls[1].sql).toBe('UPDATE organizations SET updated_at = NOW() WHERE id = $1')
    expect(calls[1].params).toEqual(['org-1'])
})
