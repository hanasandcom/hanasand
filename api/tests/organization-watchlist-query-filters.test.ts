import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params: unknown[] }> = []
let watchlistRows: Array<Record<string, unknown>> = []

mock.module('#db', () => {
    const query = async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        if (sql.includes('FROM organizations o')) {
            return { rows: [{
                id: 'org-1', name: 'Organization', slug: 'organization', status: 'active', role: 'owner',
                member_count: 1, owner_count: 1, admin_count: 1, pending_invite_count: 0, shared_watchlist_count: 0,
            }] }
        }
        if (sql.includes('FROM organization_watchlist_items')) {
            const [organizationId, includeArchived, kind, status] = params as [string, boolean, string | null, string | null]
            const rows = watchlistRows.filter(row => row.organization_id === organizationId
                && (includeArchived || !row.archived_at)
                && (!kind || row.kind === kind)
                && (!status || row.status === status))
            return { rows }
        }
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
    touchOrganization: async () => undefined,
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
beforeEach(() => {
    queries.length = 0
    watchlistRows = []
})
afterAll(() => app.close())

const cases = [
    { label: 'normalizes recognized values', query: '?kind=DOMAIN&status=PAUSED', expected: ['org-1', false, 'domain', 'paused'], itemIds: ['paused-domain'] },
    { label: 'includes archived rows for archived status', query: '?kind=KEYWORD&status=ARCHIVED', expected: ['org-1', true, 'keyword', 'archived'], itemIds: ['archived-keyword'] },
    { label: 'includes timestamp-archived rows when requested', query: '?includeArchived=true', expected: ['org-1', true, null, null], itemIds: ['active-domain', 'archived-keyword', 'archived-status', 'archived-timestamp', 'paused-domain'] },
    { label: 'ignores blank values', query: '?kind=%20%20&status=%20%20', expected: ['org-1', false, null, null], itemIds: ['active-domain', 'archived-status', 'paused-domain'] },
    { label: 'ignores invalid values', query: '?kind=not-a-kind&status=deleted', expected: ['org-1', false, null, null], itemIds: ['active-domain', 'archived-status', 'paused-domain'] },
]

for (const scenario of cases) {
    test(`GET watchlists ${scenario.label}`, async () => {
        watchlistRows = [
            { id: 'active-domain', organization_id: 'org-1', kind: 'domain', value: 'active.example', status: 'active' },
            { id: 'paused-domain', organization_id: 'org-1', kind: 'domain', value: 'paused.example', status: 'paused' },
            { id: 'archived-status', organization_id: 'org-1', kind: 'company', value: 'Archived Ltd', status: 'archived' },
            { id: 'archived-timestamp', organization_id: 'org-1', kind: 'vendor', value: 'Old Acme', status: 'active', archived_at: '2026-02-01T00:00:00.000Z' },
            { id: 'archived-keyword', organization_id: 'org-1', kind: 'keyword', value: 'legacy', status: 'archived', archived_at: '2026-02-02T00:00:00.000Z' },
        ]
        const response = await app.inject(`/organizations/org-1/watchlists${scenario.query}`)
        expect(response.statusCode).toBe(200)

        const listQuery = queries.find(query => /SELECT \*\s+FROM organization_watchlist_items/.test(query.sql))
        expect(listQuery?.params).toEqual(scenario.expected)
        expect(listQuery?.sql).toContain('AND ($2::boolean IS TRUE OR archived_at IS NULL)')
        expect(listQuery?.sql).toContain('AND ($3::text IS NULL OR kind = $3)')
        expect(listQuery?.sql).toContain('AND ($4::text IS NULL OR status = $4)')
        expect(response.json().watchlistItems.map((item: { id: string }) => item.id).sort()).toEqual([...scenario.itemIds].sort())
    })
}

test('GET watchlists uses shared lifecycle status normalization in its contract', async () => {
    watchlistRows = [
        { id: 'active-default', organization_id: 'org-1', kind: 'domain', value: 'example.com', notes: '', created_by: 'owner-1', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'timestamp-archived', organization_id: 'org-1', kind: 'vendor', value: 'Acme', notes: '', status: 'active', archived_at: '2026-02-01T00:00:00.000Z', created_by: 'owner-1', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'status-archived', organization_id: 'org-1', kind: 'company', value: 'Example Ltd', notes: '', status: 'archived', created_by: 'owner-1', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'paused', organization_id: 'org-1', kind: 'vendor', value: 'Acme', notes: '', status: 'paused', created_by: 'owner-1', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ]

    const response = await app.inject('/organizations/org-1/watchlists?includeArchived=true')
    expect(response.statusCode).toBe(200)
    expect(response.json().sharedWatchlistContract).toMatchObject({
        capabilities: {
            authoritativeProjectionSync: true,
            projectionReconcile: true,
            projectionReceiptSchemaVersion: 'organization.watchlist_projection_receipt.v1',
        },
        permissions: { canReconcile: true },
        lifecycle: {
            reconcileRoute: 'POST /api/organizations/:id/watchlists/reconcile',
            activeCount: 1,
            pausedCount: 1,
            archivedCount: 2,
        },
        ownership: {
            activeItemIds: ['active-default'],
            pausedItemIds: ['paused'],
            archivedItemIds: ['timestamp-archived', 'status-archived'],
        },
    })
})
