import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params: unknown[] }> = []

mock.module('#db', () => {
    const query = async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        if (sql.includes('FROM organizations o')) {
            return { rows: [{
                id: 'org-1', name: 'Organization', slug: 'organization', status: 'active', role: 'owner',
                member_count: 1, owner_count: 1, admin_count: 1, pending_invite_count: 0, shared_watchlist_count: 0,
            }] }
        }
        if (sql.includes('FROM organization_watchlist_items')) return { rows: [] }
        return { rows: [] }
    }
    return {
        default: query,
        withTransaction: async (work: (query: typeof query) => unknown) => work(query),
        withDatabaseAdvisoryLock: async (_key: string, work: () => unknown) => work(),
        identityQueryOnce: query,
    }
})
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'owner-1' }) }))
mock.module('#utils/db/analysisPolicySchema.ts', () => ({ ensureEventProtectionRule: async () => undefined }))
mock.module('#utils/organizationLifecycle.ts', () => ({ organizationPrivacyDeletionInProgress: async () => false }))
mock.module('#utils/db/identityDataWrites.ts', () => ({
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

const { getOrganizationWatchlists } = await import('../src/handlers/organizations.ts')

const app = Fastify()
app.get('/organizations/:id/watchlists', getOrganizationWatchlists)
beforeEach(() => { queries.length = 0 })
afterAll(() => app.close())

const cases = [
    { label: 'normalizes recognized values', query: '?kind=DOMAIN&status=PAUSED', expected: ['org-1', false, 'domain', 'paused'] },
    { label: 'includes archived rows for archived status', query: '?kind=KEYWORD&status=ARCHIVED', expected: ['org-1', true, 'keyword', 'archived'] },
    { label: 'ignores blank values', query: '?kind=%20%20&status=%20%20', expected: ['org-1', false, null, null] },
    { label: 'ignores invalid values', query: '?kind=not-a-kind&status=deleted', expected: ['org-1', false, null, null] },
]

for (const scenario of cases) {
    test(`GET watchlists ${scenario.label}`, async () => {
        const response = await app.inject(`/organizations/org-1/watchlists${scenario.query}`)
        expect(response.statusCode).toBe(200)

        const listQuery = queries.find(query => /SELECT \*\s+FROM organization_watchlist_items/.test(query.sql))
        expect(listQuery?.params).toEqual(scenario.expected)
    })
}
