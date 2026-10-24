import { createHmac } from 'node:crypto'
import { afterAll, beforeEach, expect, mock, test } from 'bun:test'

const previous = {
    enabled: process.env.LOGS_OUTBOX_ENABLED,
    url: process.env.LOGS_SERVICE_URL,
    ingest: process.env.LOGS_SERVICE_INGEST_TOKEN,
    sync: process.env.LOGS_SERVICE_SYNC_TOKEN,
    platform: process.env.PLATFORM_LOG_ORGANIZATION_ID,
    remoteOnly: process.env.LOGS_OUTBOX_REMOTE_ONLY,
    direct: process.env.LOGS_SERVICE_DIRECT,
    applicationLogHmac: process.env.LOGS_APPLICATION_LOG_HMAC_KEY,
    apiHttpOnly: process.env.API_HTTP_ONLY,
    deploymentCandidateOnly: process.env.DEPLOYMENT_CANDIDATE_ONLY,
}

const statements: Array<{ sql: string; params: unknown[] }> = []
const originalFetch = globalThis.fetch
let transactions = 0
const organizations = [
    { id: 'platform', name: 'Hanasand', status: 'active', retention_days: 365, audit_safe_metadata: {}, updated_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tenant-a', name: 'Tenant A', status: 'active', retention_days: 90, audit_safe_metadata: {}, updated_at: '2026-01-01T00:00:00.000Z' },
]
const query = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.includes('FROM organizations WHERE id > $1')) return { rows: organizations }
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
    withTransaction: async (work: (tx: typeof query) => unknown) => { transactions++; return work(query) },
}))

const { assertRemoteLogsConfiguration, publishLogsToIndependentService, ensureLogsOutboxSchema, refreshLogsOrganizationSnapshotBatch, shouldRunLegacyLogProcessing, shouldRunLogsServiceBackgroundTasks } = await import('../src/utils/logs/logOutbox.ts')
const { default: recordLog, recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
const applicationLogPrefix = 'HANASAND_APPLICATION_LOG_V1 '

function captureApplicationLogs() {
    const lines: string[] = []
    const original = console.info
    console.info = (...values) => { lines.push(String(values[0])) }
    return { lines, restore: () => { console.info = original } }
}

function decodeApplicationLog(line: string) {
    expect(line.startsWith(applicationLogPrefix)).toBe(true)
    return JSON.parse(Buffer.from(line.slice(applicationLogPrefix.length), 'base64url').toString('utf8')) as {
        schema: string; event: Record<string, unknown>; signature: string
    }
}

beforeEach(() => {
    statements.length = 0
    transactions = 0
    process.env.LOGS_OUTBOX_ENABLED = '1'
    process.env.LOGS_SERVICE_URL = 'https://logs.hanasand.com'
    process.env.LOGS_SERVICE_INGEST_TOKEN = 'i'.repeat(40)
    process.env.LOGS_SERVICE_SYNC_TOKEN = 's'.repeat(40)
    process.env.LOGS_APPLICATION_LOG_HMAC_KEY = 'application-log-test-signing-key-32-bytes'
    process.env.PLATFORM_LOG_ORGANIZATION_ID = 'platform'
    delete process.env.LOGS_OUTBOX_REMOTE_ONLY
    delete process.env.LOGS_SERVICE_DIRECT
    delete process.env.API_HTTP_ONLY
    delete process.env.DEPLOYMENT_CANDIDATE_ONLY
    globalThis.fetch = originalFetch
})

afterAll(() => {
    const values = [
        ['LOGS_OUTBOX_ENABLED', previous.enabled], ['LOGS_SERVICE_URL', previous.url],
        ['LOGS_SERVICE_INGEST_TOKEN', previous.ingest], ['LOGS_SERVICE_SYNC_TOKEN', previous.sync],
        ['PLATFORM_LOG_ORGANIZATION_ID', previous.platform],
        ['LOGS_OUTBOX_REMOTE_ONLY', previous.remoteOnly],
        ['LOGS_SERVICE_DIRECT', previous.direct],
        ['LOGS_APPLICATION_LOG_HMAC_KEY', previous.applicationLogHmac],
        ['API_HTTP_ONLY', previous.apiHttpOnly],
        ['DEPLOYMENT_CANDIDATE_ONLY', previous.deploymentCandidateOnly],
    ] as const
    for (const [key, value] of values) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
    globalThis.fetch = originalFetch
})

test('keeps an active tenant event scoped to that tenant', async () => {
    await publishLogsToIndependentService([{
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
    await publishLogsToIndependentService([{
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
    await expect(publishLogsToIndependentService([{
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

test('outbox remote-only mode durably queues application events without retaining a Hanasand events copy', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    const one = { service: 'hanasand-api', level: 'info' as const, message: 'single event', sourceEventId: 'single-event' }
    const batch = { service: 'hanasand-api', level: 'warn' as const, message: 'batch event', sourceEventId: 'batch-event' }
    const transactionQuery = async (sql: string, params: unknown[] = []) => query(sql, params)

    expect(await recordLog(one, transactionQuery as never)).toBe('single-event')
    await recordLogBatch([batch], transactionQuery as never)

    expect(statements.filter(item => item.sql.includes('INSERT INTO log_delivery_outbox'))).toHaveLength(2)
    expect(statements.some(item => item.sql.includes('INSERT INTO events'))).toBe(false)
})

test('remote-only mode fails closed when both direct delivery and the durable outbox are disabled', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    const transactionQuery = async (sql: string, params: unknown[] = []) => query(sql, params)

    await expect(recordLog({ service: 'hanasand-api', level: 'error', message: 'event' }, transactionQuery as never))
        .rejects.toThrow('requires the durable outbox or LOGS_SERVICE_DIRECT=1')
    expect(statements).toHaveLength(0)
})

test('remote-only mode disables legacy processing while the outbox remains available', () => {
    process.env.LOGS_OUTBOX_ENABLED = '1'
    expect(shouldRunLegacyLogProcessing()).toBe(true)
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    expect(shouldRunLegacyLogProcessing()).toBe(false)
    expect(process.env.LOGS_OUTBOX_ENABLED).toBe('1')
})

test('only outbox deployments run shared Logs background tasks; direct delivery is request-scoped', () => {
    process.env.API_HTTP_ONLY = '1'
    expect(shouldRunLogsServiceBackgroundTasks()).toBe(false)
    process.env.LOGS_SERVICE_DIRECT = '1'
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    expect(shouldRunLogsServiceBackgroundTasks()).toBe(false)
    process.env.DEPLOYMENT_CANDIDATE_ONLY = '1'
    expect(shouldRunLogsServiceBackgroundTasks()).toBe(true)
    process.env.LOGS_OUTBOX_ENABLED = '0'
    expect(shouldRunLogsServiceBackgroundTasks()).toBe(false)
})

test('remote-only mode refuses to start without its durable outbox and credentials', () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    expect(() => assertRemoteLogsConfiguration()).toThrow('requires the durable outbox or LOGS_SERVICE_DIRECT=1')

    process.env.LOGS_OUTBOX_ENABLED = '1'
    delete process.env.LOGS_SERVICE_INGEST_TOKEN
    expect(() => assertRemoteLogsConfiguration()).toThrow('Logs URL and valid ingest and sync tokens')

    process.env.LOGS_SERVICE_INGEST_TOKEN = 'i'.repeat(40)
    expect(() => assertRemoteLogsConfiguration()).not.toThrow()
})

test('direct mode requires the Logs envelope signing key', () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_SERVICE_DIRECT = '1'
    delete process.env.LOGS_APPLICATION_LOG_HMAC_KEY
    expect(() => assertRemoteLogsConfiguration()).toThrow('valid LOGS_APPLICATION_LOG_HMAC_KEY')
})

test('direct remote-only mode sends events without querying Hanasand organization or rule state', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_SERVICE_DIRECT = '1'
    const capture = captureApplicationLogs()
    const entry = { service: 'hanasand-api', level: 'info' as const, message: 'direct event', sourceEventId: 'direct-event' }

    try {
        expect(await recordLog(entry)).toBe('direct-event')
        await recordLog({ ...entry, message: 'second direct event', sourceEventId: 'direct-event-2' })
    } finally { capture.restore() }

    expect(capture.lines).toHaveLength(2)
    const first = decodeApplicationLog(capture.lines[0]!)
    const second = decodeApplicationLog(capture.lines[1]!)
    expect(first).toMatchObject({ schema: 'hanasand.application-log.v1', event: { sourceEventId: 'direct-event', message: 'direct event' } })
    expect(first.signature).toBe(createHmac('sha256', process.env.LOGS_APPLICATION_LOG_HMAC_KEY!).update(JSON.stringify(first.event)).digest('hex'))
    expect(second).toMatchObject({ schema: 'hanasand.application-log.v1', event: { sourceEventId: 'direct-event-2', message: 'second direct event' } })
    expect(statements.some(item => item.sql.includes('FROM organizations') || item.sql.includes('FROM rules'))).toBe(false)
    expect(statements.some(item => item.sql.includes('INSERT INTO log_delivery_outbox'))).toBe(false)
    expect(statements.some(item => item.sql.includes('INSERT INTO log_organization_sync_outbox'))).toBe(false)
    expect(statements.some(item => item.sql.includes('INSERT INTO events'))).toBe(false)
    expect(transactions).toBe(0)
})

test('direct remote-only batch delivery emits each source identity for the host collector', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_SERVICE_DIRECT = '1'
    const capture = captureApplicationLogs()
    try {
        await recordLogBatch([
            { service: 'hanasand-api', level: 'info', message: 'first', sourceEventId: 'direct-batch-1' },
            { service: 'hanasand-api', level: 'info', message: 'second', sourceEventId: 'direct-batch-2' },
        ], query as never)
    } finally { capture.restore() }
    expect(capture.lines.map(line => decodeApplicationLog(line).event.sourceEventId)).toEqual(['direct-batch-1', 'direct-batch-2'])
    expect(statements.some(item => item.sql.includes('INSERT INTO log_delivery_outbox'))).toBe(false)
    expect(statements.some(item => item.sql.includes('INSERT INTO log_organization_sync_outbox'))).toBe(false)
})

test('direct producer normalizes events to the Logs ingest field limits before signing', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_SERVICE_DIRECT = '1'
    const capture = captureApplicationLogs()
    let returnedId: string | undefined
    try {
        returnedId = await recordLog({
            service: 's'.repeat(257), host: 'h'.repeat(257), level: 'trace' as never,
            message: 'x'.repeat(65_537), metadata: {}, sourceEventId: 'i'.repeat(257), timestamp: 'not-a-timestamp',
        })
        await recordLog({
            service: 'worker', level: 'info', message: 'x'.repeat(65_536), metadata: {},
            sourceEventId: 'at-limit-event', timestamp: '2026-10-24T12:00:00.000Z',
        })
    } finally { capture.restore() }

    expect(capture.lines).toHaveLength(2)
    const normalized = decodeApplicationLog(capture.lines[0]!).event
    expect(normalized.service).toHaveLength(256)
    expect(normalized.host).toHaveLength(256)
    expect(normalized.level).toBe('info')
    expect(String(normalized.message)).toHaveLength(65_536)
    expect(String(normalized.sourceEventId)).toHaveLength(73)
    expect(returnedId).toBe(normalized.sourceEventId)
    expect(Number.isFinite(Date.parse(String(normalized.timestamp)))).toBe(true)
    expect(normalized.metadata).toMatchObject({ hanasandProducerNormalization: {
        serviceTruncated: true, hostTruncated: true, levelReplaced: true, messageTruncated: true,
        sourceEventIdHashed: true, timestampReplaced: true,
    } })
    expect(decodeApplicationLog(capture.lines[1]!).event.message).toHaveLength(65_536)
    expect((decodeApplicationLog(capture.lines[1]!).event.metadata as Record<string, unknown>))
        .not.toHaveProperty('hanasandProducerNormalization')
    for (const line of capture.lines) {
        const envelope = decodeApplicationLog(line)
        expect(envelope.signature).toBe(createHmac('sha256', process.env.LOGS_APPLICATION_LOG_HMAC_KEY!)
            .update(JSON.stringify(envelope.event)).digest('hex'))
    }
})

test('direct remote-only mode refuses delivery inside a Hanasand transaction', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_SERVICE_DIRECT = '1'
    let remoteCalls = 0
    globalThis.fetch = async () => {
        remoteCalls++
        return new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 201 })
    }
    const transactionQuery = async () => ({ rows: [] })
    await expect(recordLogBatch([{
        service: 'worker', level: 'info', message: 'transaction-bound event', sourceEventId: 'transaction-bound-event',
    }], transactionQuery as never)).rejects.toThrow('cannot run inside a Hanasand database transaction')
    expect(remoteCalls).toBe(0)
})

test('direct remote-only mode rejects a collector envelope above the bounded record size', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_SERVICE_DIRECT = '1'
    const capture = captureApplicationLogs()
    try {
        await expect(publishLogsToIndependentService([{
            service: 'worker', message: 'valid message', metadata: { payload: 'x'.repeat(400_000) }, sourceEventId: 'oversize-event',
        }], query as never)).rejects.toThrow('collector envelope size limit')
    } finally { capture.restore() }
    expect(capture.lines).toHaveLength(0)
    expect(statements.some(item => item.sql.includes('INSERT INTO log_delivery_outbox'))).toBe(false)
})

test('direct-only mode emits logs without Logs API credentials', async () => {
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_SERVICE_DIRECT = '1'
    delete process.env.LOGS_SERVICE_URL
    delete process.env.LOGS_SERVICE_INGEST_TOKEN
    delete process.env.LOGS_SERVICE_SYNC_TOKEN
    const capture = captureApplicationLogs()
    try { await publishLogsToIndependentService([{
        service: 'worker', message: 'event', metadata: {}, sourceEventId: 'outage-event',
    }], query as never) }
    finally { capture.restore() }
    expect(capture.lines).toHaveLength(1)
    expect(decodeApplicationLog(capture.lines[0]!).event.sourceEventId).toBe('outage-event')
    expect(statements.some(item => item.sql.includes('INSERT INTO log_delivery_outbox'))).toBe(false)
})

test('direct-only mode requires remote-only processing but not Hanasand-to-Logs credentials', () => {
    process.env.LOGS_SERVICE_DIRECT = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '0'
    expect(() => assertRemoteLogsConfiguration()).toThrow('requires LOGS_OUTBOX_REMOTE_ONLY=1')
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    delete process.env.LOGS_SERVICE_URL
    delete process.env.LOGS_SERVICE_INGEST_TOKEN
    expect(() => assertRemoteLogsConfiguration()).not.toThrow()
    delete process.env.LOGS_SERVICE_SYNC_TOKEN
    expect(() => assertRemoteLogsConfiguration()).not.toThrow()
})

test('direct mode does not create Hanasand outbox tables when the durable transfer is disabled', async () => {
    process.env.LOGS_SERVICE_DIRECT = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    await ensureLogsOutboxSchema(query as never)
    expect(statements).toHaveLength(0)
})

test('direct-only mode does not run a Hanasand-backed organization refresh', async () => {
    process.env.LOGS_SERVICE_DIRECT = '1'
    process.env.LOGS_OUTBOX_ENABLED = '0'
    process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
    expect(await refreshLogsOrganizationSnapshotBatch(query as never)).toBe(0)
    expect(statements).toHaveLength(0)
    expect(statements.some(item => item.sql.includes('INSERT INTO log_organization_sync_cursor'))).toBe(false)
})
