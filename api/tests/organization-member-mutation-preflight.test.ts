import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: string[] = []
const transactionTouches: Array<{ sql: string; values: unknown[] }> = []
let organizationMembershipAvailable = true
let allowMemberMutations = false
let databaseQuery: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> = async () => ({ rows: [] })

mock.module('#db', () => {
    const query = async (sql: string, values: unknown[] = []) => {
        queries.push(sql)
        if (sql.includes('FROM organizations o')) {
            return { rows: organizationMembershipAvailable ? [{
                id: 'org-1', name: 'Organization', slug: 'organization', status: allowMemberMutations ? 'active' : 'archived', role: 'owner',
                member_count: 1, owner_count: 1, admin_count: 1, pending_invite_count: 0, shared_watchlist_count: 0,
            }] : [] }
        }
        if (sql.includes('COUNT(*)::int AS owner_count')) return { rows: [{ owner_count: 2 }] }
        if (sql.includes('FROM organization_members')) {
            return { rows: [{ organization_id: 'org-1', user_id: 'member-1', role: 'reader', status: 'active' }] }
        }
        if (sql.trimStart().startsWith('UPDATE organization_members')) {
            return { rows: [{ organization_id: 'org-1', user_id: values[1] ?? 'member-1', role: 'reader', status: 'active' }] }
        }
        return { rows: [] }
    }
    databaseQuery = query
    const transactionQuery = async (sql: string, values: unknown[] = []) => {
        if (sql.includes('UPDATE organizations SET updated_at = NOW()')) transactionTouches.push({ sql: sql.replace(/\s+/g, ' ').trim(), values })
        return query(sql, values)
    }
    return {
        default: query,
        withTransaction: async (work: (query: typeof query) => unknown) => work(transactionQuery),
        withDatabaseAdvisoryLock: async (_key: string, work: () => unknown) => work(),
        identityQueryOnce: query,
    }
})
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'owner-1' }) }))
mock.module('#utils/db/analysisPolicySchema.ts', () => ({ ensureEventProtectionRule: async () => undefined }))
mock.module('#utils/organizationLifecycle.ts', () => ({ organizationPrivacyDeletionInProgress: () => false }))
mock.module('#utils/db/identityDataWrites.ts', () => ({
    touchOrganization: async (organizationId: string, query = databaseQuery) => query('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organizationId]),
    updateActiveOrganizationMemberRole: async () => undefined,
    updateOrganizationInviteAction: async () => undefined,
    upsertOrganizationInvite: async () => undefined,
    upsertOrganizationMember: async () => undefined,
}))
mock.module('#utils/organizationMemberships.ts', () => ({ activeOrganizationOwnerCount: async () => 1 }))
mock.module('#utils/logs/recordLog.ts', () => ({ default: async () => undefined }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async () => undefined }))
mock.module('../src/handlers/billing.ts', () => ({ checkBillingCapacity: async () => true }))
mock.module('#utils/auth/apiKeys.ts', () => ({
    createApiKey: async () => undefined,
    listOrganizationApiKeys: async () => [],
    organizationPublicApiScopes: [],
    revokeOrganizationApiKey: async () => undefined,
}))

const { deleteOrganizationMember, patchOrganizationMemberRole, postOrganizationOwnershipTransfer, postOrganizationWatchlist } = await import('../src/handlers/organizations.ts')

const app = Fastify()
app.delete('/organizations/:id/members/:userId', deleteOrganizationMember)
app.patch('/organizations/:id/members/:userId', patchOrganizationMemberRole)
app.post('/organizations/:id/ownership-transfer', postOrganizationOwnershipTransfer)
app.post('/organizations/:id/watchlists', postOrganizationWatchlist)
beforeEach(() => { queries.length = 0; transactionTouches.length = 0; organizationMembershipAvailable = true; allowMemberMutations = false })
afterAll(() => app.close())

test('member removal and role changes block archived organizations before target lookup', async () => {
    const removal = await app.inject({ method: 'DELETE', url: '/organizations/org-1/members/member-1' })
    const roleChange = await app.inject({
        method: 'PATCH',
        url: '/organizations/org-1/members/member-1',
        payload: { role: 'reader', reason: 'review access' },
    })

    expect(removal.statusCode).toBe(409)
    expect(removal.json().lifecycleBlocker.action).toBe('remove members')
    expect(roleChange.statusCode).toBe(409)
    expect(roleChange.json().lifecycleBlocker.action).toBe('change member roles')
    expect(queries.some(sql => sql.includes('FROM organization_members om'))).toBe(false)
})

test('watchlist mutations return the established not-found response before input validation for nonmembers', async () => {
    organizationMembershipAvailable = false
    const response = await app.inject({
        method: 'POST',
        url: '/organizations/org-1/watchlists',
        payload: {},
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Organization not found.' })
    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('FROM organizations o')
})

test('member removal and ownership transfer touch the organization inside their transaction', async () => {
    allowMemberMutations = true
    const removal = await app.inject({ method: 'DELETE', url: '/organizations/org-1/members/member-1' })
    const transfer = await app.inject({
        method: 'POST',
        url: '/organizations/org-1/ownership-transfer',
        payload: { targetUserId: 'member-1', reason: 'Transfer ownership.' },
    })

    expect(removal.statusCode).toBe(200)
    expect(transfer.statusCode).toBe(200)
    expect(transactionTouches).toHaveLength(2)
    expect(transactionTouches.map(touch => [touch.sql, touch.values])).toEqual([
        ['UPDATE organizations SET updated_at = NOW() WHERE id = $1', ['org-1']],
        ['UPDATE organizations SET updated_at = NOW() WHERE id = $1', ['org-1']],
    ])
})
