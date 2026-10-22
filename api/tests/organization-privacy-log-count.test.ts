import { beforeEach, expect, mock, test } from 'bun:test'

const queries: Array<{ sql: string, values?: unknown[] }> = []
let count: unknown = 7
let failure: Error | undefined
let attempts = 0
mock.module('#db', () => ({
    withReadDatabase: async (work: () => Promise<unknown>) => work(),
    withTransaction: async (work: (query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<unknown>) => work(async (sql, values) => {
        queries.push({ sql, values })
        if (sql.includes('AS immutable_log_events')) {
            attempts++
            if (failure) throw failure
            return { rows: [{ immutable_log_events: count }] }
        }
        return { rows: [] }
    }),
    isTransientDatabaseError: (error: { code?: string }) => ['ECONNRESET', 'ETIMEDOUT'].includes(error.code || ''),
    queryOnce: async (sql: string) => {
        queries.push({ sql })
        if (sql.includes('SELECT id, name')) return { rows: [{ id: 'org-test', name: 'Synthetic', status: 'active', retention_days: 30 }] }
        if (sql.includes('SELECT\n')) return { rows: [{ protected_events: 2, total_retention_items: 1, access_recovery_holds: 1, immutable_system_events: 4, immutable_webhook_audit_events: 3 }] }
        if (sql.includes('SELECT item.*')) return { rows: [{ run_id: 'run-test', status: 'protected' }] }
        return { rows: [] }
    },
}))
const { readImmutableOrganizationLogCount } = await import('../src/utils/organizationPrivacyLogCount.ts')
const { organizationPrivacyState } = await import('../src/utils/organizationPrivacyRead.ts')
beforeEach(() => { queries.length = 0; count = 7; failure = undefined; attempts = 0 })

test('exact metric uses a separate read-only database transaction with actual statement cancellation budget', async () => {
    expect(await readImmutableOrganizationLogCount('org-test')).toEqual({ value: 7, available: true })
    expect(queries.map(query => query.sql).slice(0, 4)).toEqual(['SET TRANSACTION READ ONLY', 'SET LOCAL statement_timeout = \'750ms\'', 'SET LOCAL lock_timeout = \'100ms\'', 'SET LOCAL max_parallel_workers_per_gather = 0'])
    const query = queries.at(-1)!
    expect(query.sql).toContain('ingestion_id=\'logs\'')
    expect(query.sql).toContain('normalized #>> \'{metadata,organizationId}\' = $1')
    expect(query.sql).toContain('OR normalized #>> \'{metadata,tenantId}\' = $1')
    expect(query.sql).not.toContain('organization_id =')
    expect(query.values).toEqual(['org-test'])
    expect(attempts).toBe(1)
})
test('a real zero remains available and is distinct from a timeout', async () => {
    count = 0
    expect(await readImmutableOrganizationLogCount('org-test')).toEqual({ value: 0, available: true })
    failure = Object.assign(new Error('cancelled by statement timeout'), { code: '57014' })
    expect(await readImmutableOrganizationLogCount('org-test')).toEqual({ value: null, available: false, reason: 'timeout' })
})
test('known lock/queue/transient errors make only the metric unavailable, without retrying', async () => {
    for (const code of ['55P03', 'DB_QUEUE_FULL', 'ECONNRESET', 'ETIMEDOUT']) {
        failure = Object.assign(new Error('Synthetic database failure'), { code })
        expect((await readImmutableOrganizationLogCount('org-test')).value).toBeNull()
    }
    expect(attempts).toBe(4)
})
test('unexpected schema/query errors and invalid counts propagate instead of masquerading as unavailable', async () => {
    failure = Object.assign(new Error('Missing synthetic relation'), { code: '42P01' })
    await expect(readImmutableOrganizationLogCount('org-test')).rejects.toThrow('Missing synthetic relation')
    failure = undefined; count = undefined
    await expect(readImmutableOrganizationLogCount('org-test')).rejects.toThrow('count was invalid')
})
test('privacy state retains organization/history/protection/page data when only the optional count times out', async () => {
    failure = Object.assign(new Error('statement timeout'), { code: '57014' })
    const result = await organizationPrivacyState('org-test')
    expect(result.organization).toMatchObject({ id: 'org-test', retention_days: 30 })
    expect(result.items).toHaveLength(1)
    expect(result.itemPage.nextOffset).toBeNull()
    expect(result.protection).toMatchObject({ protected_events: 2, access_recovery_holds: 1, immutable_system_events: 4, immutable_webhook_audit_events: 3, immutable_log_events: null, immutable_log_events_available: false, immutable_log_events_unavailable_reason: 'timeout' })
    expect(result.warnings).toEqual(['The immutable log count is temporarily unavailable. Other retention details remain available.'])
    expect(queries.filter(query => query.sql.includes('AS immutable_log_events'))).toHaveLength(1)
    const otherCounts = queries.find(query => query.sql.includes('total_retention_items'))!
    expect(otherCounts.sql).not.toContain('FROM events')
})
test('successful exact count has explicit availability and no unavailable warning', async () => {
    const result = await organizationPrivacyState('org-test')
    expect(result.protection).toMatchObject({ immutable_log_events: 7, immutable_log_events_available: true })
    expect(result.protection).not.toHaveProperty('immutable_log_events_unavailable_reason')
    expect(result.warnings).toEqual([])
})
