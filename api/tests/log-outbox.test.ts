import { afterAll, beforeEach, expect, mock, test } from 'bun:test'

const previous = {
    enabled: process.env.LOGS_OUTBOX_ENABLED,
    url: process.env.LOGS_SERVICE_URL,
    ingest: process.env.LOGS_SERVICE_INGEST_TOKEN,
    sync: process.env.LOGS_SERVICE_SYNC_TOKEN,
    platform: process.env.PLATFORM_LOG_ORGANIZATION_ID,
    remoteOnly: process.env.LOGS_OUTBOX_REMOTE_ONLY,
}

const statements: Array<{ sql: string; params: unknown[] }> = []
const organizations = [
    { id: 'platform', name: 'Hanasand', status: 'active', retention_days: 365, audit_safe_metadata: {}, updated_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tenant-a', name: 'Tenant A', status: 'active', retention_days: 90, audit_safe_metadata: {}, updated_at: '2026-01-01T00:00:00.000Z' },
]
const query = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.includes('FROM organizations, cursor')) return { rows: organizations }
    if (sql.includes('FROM organizations')) {
        const requested = params[0] as string[]
        return { rows: organizations.filter(item => requested.includes(item.id) || item.id === params[1]) }
    }
    if (sql.includes('FROM rules')) return { rows: [] }
    return { rows: [] }
}

mock.module('#db', () => ({
    default: query,
    identityQueryOnce: query,
    isTransientDatabaseError: () => false,
    withTransaction: async (work: (tx: typeof query) => unknown) => work(query),
}))

const { assertRemoteLogsConfiguration, enqueueLogsForIndependentService, refreshLogsOrganizationSnapshotBatch, shouldRunLegacyLogProcessing } = await import('../src/utils/logs/logOutbox.ts')
const { default: recordLog, recordLogBatch } = await import('../src/utils/logs/recordLog.ts')

beforeEach(() => {
    statements.length = 0
    process.env.LOGS_OUTBOX_ENABLED = '1'
    process.env.LOGS_SERVICE_URL = 'https://logs.hanasand.com'
    process.env.LOGS_SERVICE_INGEST_TOKEN = 'i'.repeat(40)
    process.env.LOGS_SERVICE_SYNC_TOKEN = 's'.repeat(40)
    process.env.PLATFORM_LOG_ORGANIZATION_ID = 'platform'
    delete process.env.LOGS_OUTBOX_REMOTE_ONLY
})

afterAll(() => {
    const values = [
        ['LOGS_OUTBOX_ENABLED', previous.enabled], ['LOGS_SERVICE_URL', previous.url],
        ['LOGS_SERVICE_INGEST_TOKEN', previous.ingest], ['LOGS_SERVICE_SYNC_TOKEN', previous.sync],
        ['PLATFORM_LOG_ORGANIZATION_ID', previous.platform],
        ['LOGS_OUTBOX_REMOTE_ONLY', previous.remoteOnly],
    ] as const
    for (const [key, value] of values) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})

test('keeps an active tenant event scoped to that tenant', async () => {
    await enqueueLogsForIndependentService([{
        service: 'worker', host: 'host-a', level: 'info', message: 'tenant event',
        metadata: { organizationId: 'tenant-a' }, sourceEventId: 'stable-event-id',
    }], query as never)

    const eventInsert = statements.find(item => item.sql.includes('INSERT INTO log_delivery_outbox'))
    expect(eventInsert).toBeDefined()
    const entries = JSON.parse((eventInsert!.params[0] as string)) as Array<{ organization_id: string; payload: { message: string; metadata: Record<string, unknown>; sourceEventId: string } }>
    expect(entries[0]?.organization_id).toBe('tenant-a')
    expect(entries[0]?.payload.metadata.organizationId).toBe('tenant-a')
    expect(entries[0]?.payload.message).toBe('tenant event')
    expect(entries[0]?.payload.sourceEventId).toBe('stable-event-id')
})

test('sanitizes events whose tenant scope cannot be resolved instead of attributing their content to the platform', async () => {
    await enqueueLogsForIndependentService([{
        service: 'worker', host: 'host-a', level: 'info', message: 'private tenant event',
        metadata: { organizationId: 'missing-tenant', secret: 'private-value' }, sourceEventId: 'stable-orphan-id',
    }], query as never)

    const eventInsert = statements.find(item => item.sql.includes('INSERT INTO log_delivery_outbox'))
    expect(eventInsert).toBeDefined()
    const entries = JSON.parse((eventInsert!.params[0] as string)) as Array<{ organization_id: string; payload: { message: string; metadata: Record<string, unknown> } }>
    expect(entries[0]?.organization_id).toBe('platform')
    expect(entries[0]?.payload.message).toBe('organization_event')
    expect(entries[0]?.payload.metadata).toMatchObject({
        category: 'organization_scope', action: 'unresolved_scope_event',
        requestedOrganizationId: 'missing-tenant', requestedOrganizationStatus: 'missing',
    })
    expect(JSON.stringify(entries[0]?.payload)).not.toContain('private tenant event')
    expect(JSON.stringify(entries[0]?.payload)).not.toContain('private-value')
})

test('fails closed when the configured active platform organization is unavailable', async () => {
    const unavailableQuery = async (sql: string, params: unknown[] = []) => {
        if (sql.includes('FROM organizations')) return { rows: organizations.filter(item => item.id === 'tenant-a' && (params[0] as string[]).includes(item.id)) }
        return { rows: [] }
    }
    await expect(enqueueLogsForIndependentService([{
        message: 'event', metadata: {}, sourceEventId: 'unscoped-id',
    }], unavailableQuery as never)).rejects.toThrow('active platform organization')
})

test('periodically snapshots organizations and rules even when no events were emitted', async () => {
    const count = await refreshLogsOrganizationSnapshotBatch(query as never)
    expect(count).toBe(organizations.length)
    expect(statements.some(item => item.sql.includes('FROM organizations, cursor'))).toBe(true)
    expect(statements.some(item => item.sql.includes('INSERT INTO log_organization_sync_outbox'))).toBe(true)
    expect(statements.some(item => item.sql.includes('INSERT INTO log_organization_sync_cursor'))).toBe(true)
})

test('remote-only mode durably queues application events without retaining a Hanasand events copy', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    const one = { service: 'hanasand-api', level: 'info' as const, message: 'single event', sourceEventId: 'single-event' }
    const batch = { service: 'hanasand-api', level: 'warn' as const, message: 'batch event', sourceEventId: 'batch-event' }
    const transactionQuery = async (sql: string, params: unknown[] = []) => query(sql, params)

    expect(await recordLog(one, transactionQuery as never)).toBe('single-event')
    await recordLogBatch([batch], transactionQuery as never)

    expect(statements.filter(item => item.sql.includes('INSERT INTO log_delivery_outbox'))).toHaveLength(2)
    expect(statements.some(item => item.sql.includes('INSERT INTO events'))).toBe(false)
})

test('remote-only mode fails closed when the durable Logs outbox is disabled', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    const transactionQuery = async (sql: string, params: unknown[] = []) => query(sql, params)

    await expect(recordLog({ service: 'hanasand-api', level: 'error', message: 'event' }, transactionQuery as never))
        .rejects.toThrow('requires LOGS_OUTBOX_ENABLED=1')
    expect(statements).toHaveLength(0)
})

test('remote-only mode disables legacy processing while the outbox remains available', () => {
    process.env.LOGS_OUTBOX_ENABLED = '1'
    expect(shouldRunLegacyLogProcessing()).toBe(true)
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    expect(shouldRunLegacyLogProcessing()).toBe(false)
    expect(process.env.LOGS_OUTBOX_ENABLED).toBe('1')
})

test('remote-only mode refuses to start without its durable outbox and credentials', () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    expect(() => assertRemoteLogsConfiguration()).toThrow('LOGS_OUTBOX_ENABLED=1')

    process.env.LOGS_OUTBOX_ENABLED = '1'
    delete process.env.LOGS_SERVICE_INGEST_TOKEN
    expect(() => assertRemoteLogsConfiguration()).toThrow('Logs URL and valid ingest and sync tokens')

    process.env.LOGS_SERVICE_INGEST_TOKEN = 'i'.repeat(40)
    expect(() => assertRemoteLogsConfiguration()).not.toThrow()
})
