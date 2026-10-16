import { expect, test } from 'bun:test'
import { activeOrganizationOwnerCount, organizationMembershipAvailability } from '../src/utils/organizationMemberships.ts'
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

test('organization availability excludes inactive and scheduled-deletion accounts from available roles', async () => {
    let sql = ''
    let params: unknown[] = []
    const query: typeof run = async (statement, values = []) => {
        sql = statement
        params = values
        return { rows: [{
            organization_id: 'org-1', owner_count: '3', active_owner_count: '2',
            admin_count: '4', active_admin_count: '1',
        }], rowCount: 1 }
    }

    const [availability] = await organizationMembershipAvailability(['org-1'], query)

    expect(availability).toEqual({
        organizationId: 'org-1', ownerCount: 3, activeOwnerCount: 2,
        adminCount: 4, activeAdminCount: 1,
        hasAvailableOwner: true, hasAvailableAdmin: true,
    })
    expect(sql).toContain('owner.active IS TRUE')
    expect(sql).toContain('owner.deletion_scheduled_at IS NULL')
    expect(sql).toContain('membership.status = \'active\'')
    expect(sql).toContain('membership.role = \'owner\'')
    expect(sql).toContain('membership.role IN (\'owner\', \'admin\')')
    expect(sql).toContain('membership.organization_id = ANY($1::text[])')
    expect(params).toEqual([['org-1']])
})

test('organization availability avoids a database query for an empty ID list', async () => {
    let called = false
    const query: typeof run = async () => {
        called = true
        return { rows: [], rowCount: 0 }
    }

    expect(await organizationMembershipAvailability([], query)).toEqual([])
    expect(called).toBe(false)
})
