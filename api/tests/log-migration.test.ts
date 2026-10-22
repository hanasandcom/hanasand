import { afterAll, afterEach, beforeEach, expect, mock, test } from 'bun:test'

const sourceRows = [{
    id: 'source-row-1',
    organization_id: 'tenant-a',
    event_timestamp: '2026-10-20T10:00:00.000Z',
    normalized: {
        source_event_id: 'collector-event-1', service: 'audit', host: 'inspur',
        level: 'info', message: 'process started', timestamp: '2026-10-20T10:00:00.000Z', metadata: {},
    },
}]
const statements: Array<{ sql: string; params: unknown[] }> = []
let sourceFindings: Array<Record<string, unknown>> = []
let referencedRows: Array<Record<string, unknown>> = []
let sourceModelReceipts: Array<Record<string, unknown>> = []
let sourceReadinessReceipts: Array<Record<string, unknown>> = []
let sourceProxyReceipts: Array<Record<string, unknown>> = []
let sourceAnalyzeReceipts: Array<Record<string, unknown>> = []
let sourceArchiveRows: Array<Record<string, unknown>> = []
let sourceThroughputSamples: Array<Record<string, unknown>> = []
let sourceTuningSnapshots: Array<Record<string, unknown>> = []
let findingScanReads = 0
let sourceLogsRemain = false
let sourceAnalyzeReceiptsRemain = false
let sourceSpecializedReceiptsRemain = false
let fetchHandler: typeof fetch
const previousSyncToken = process.env.LOGS_SERVICE_SYNC_TOKEN
process.env.LOGS_SERVICE_SYNC_TOKEN = 's'.repeat(40)
const query = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.includes('SELECT id FROM events') && sql.includes('id > $1')) {
        findingScanReads++
        return { rows: findingScanReads === 1 ? [{ id: 'source-row-1' }] : [] }
    }
    if (sql.includes('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id=\'logs\')')) return { rows: [{ present: sourceLogsRemain }] }
    if (sql.includes('SELECT EXISTS(SELECT 1 FROM log_analyze_receipts)')) return { rows: [{ present: sourceAnalyzeReceiptsRemain || sourceSpecializedReceiptsRemain }] }
    if (sql.includes('FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace')) {
        return { rows: [{ relname: 'log_analyze_receipts' }, { relname: 'log_dimensions' }] }
    }
    if (sql.includes('FROM events WHERE ingestion_id = \'logs\'')) return { rows: sourceRows }
    if (sql.includes('FROM findings WHERE event_ids')) return { rows: sourceFindings }
    if (sql.includes('FROM events WHERE id=ANY')) return { rows: referencedRows }
    if (sql.includes('FROM log_model_probe_receipts WHERE nonce >')) return { rows: sourceModelReceipts.filter(row => String(row.nonce) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_readiness_audit_receipts WHERE exec_id >')) return { rows: sourceReadinessReceipts.filter(row => String(row.exec_id) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_proxy_receipts WHERE key >')) return { rows: sourceProxyReceipts.filter(row => String(row.key) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_analyze_receipts WHERE key >')) return { rows: sourceAnalyzeReceipts.filter(row => String(row.key) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_throughput_samples WHERE sampled_at::text>$1')) return { rows: sourceThroughputSamples.filter(row => String(row.sampled_at) > String(params[0])).slice(0, 500) }
    if (sql.includes('FROM log_tuning_snapshots WHERE organization_id>$1')) return { rows: sourceTuningSnapshots.filter(row => String(row.organization_id) > String(params[0])).slice(0, 200) }
    if (sql.includes('to_regclass($1)')) return { rows: [{ relation: 'log_analyze_event_linkage_archive' }] }
    if (sql.includes('FROM log_analyze_event_linkage_archive') && sql.includes('WHERE (organization_id,event_id)>')) {
        const [organization, event] = params.map(String)
        return { rows: sourceArchiveRows.filter(row => String(row.organization_id) > organization
            || String(row.organization_id) === organization && String(row.event_id) > event).slice(0, 500) }
    }
    if (sql.startsWith('DELETE FROM log_analyze_event_linkage_archive')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => `${row.organization_id}:${row.event_id}`))
        const deleted = sourceArchiveRows.filter(row => ids.has(`${row.organization_id}:${row.event_id}`))
        sourceArchiveRows = sourceArchiveRows.filter(row => !ids.has(`${row.organization_id}:${row.event_id}`))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM log_model_probe_receipts')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.nonce)))
        const deleted = sourceModelReceipts.filter(row => ids.has(String(row.nonce)))
        sourceModelReceipts = sourceModelReceipts.filter(row => !ids.has(String(row.nonce)))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM log_readiness_audit_receipts')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.exec_id)))
        const deleted = sourceReadinessReceipts.filter(row => ids.has(String(row.exec_id)))
        sourceReadinessReceipts = sourceReadinessReceipts.filter(row => !ids.has(String(row.exec_id)))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM log_proxy_receipts')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.key)))
        const deleted = sourceProxyReceipts.filter(row => ids.has(String(row.key)))
        sourceProxyReceipts = sourceProxyReceipts.filter(row => !ids.has(String(row.key)))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM log_analyze_receipts')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.key)))
        const deleted = sourceAnalyzeReceipts.filter(row => ids.has(String(row.key)))
        sourceAnalyzeReceipts = sourceAnalyzeReceipts.filter(row => !ids.has(String(row.key)))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM log_throughput_samples')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.sampled_at)))
        const deleted = sourceThroughputSamples.filter(row => ids.has(String(row.sampled_at)))
        sourceThroughputSamples = sourceThroughputSamples.filter(row => !ids.has(String(row.sampled_at)))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM log_tuning_snapshots')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.organization_id)))
        const deleted = sourceTuningSnapshots.filter(row => ids.has(String(row.organization_id)))
        sourceTuningSnapshots = sourceTuningSnapshots.filter(row => !ids.has(String(row.organization_id)))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM events')) return { rows: sourceRows.map(row => ({ id: row.id })) }
    if (sql.startsWith('DELETE FROM findings')) return { rows: sourceFindings.map(row => ({ id: row.id })) }
    return { rows: [] }
}

mock.module('#db', () => ({
    queryOnce: async () => ({ rows: [] }),
    withTransaction: async (work: (tx: typeof query) => unknown) => work(query),
}))

const { clearMovedLogState, dropMigrationCursorIndex, ensureMigrationCursorIndex, estimatedPlanRows, migrateAnalysisReceipts, migrateFindings, migrateFindingsBeforeEvents, migrateLinkageArchive, migrateLogRuntimeState, migrateReceiptKind, moveOneBatch, serviceReady } = await import('../scripts/migrate-logs-to-service.ts')

beforeEach(() => {
    statements.length = 0
    sourceFindings = []
    referencedRows = []
    sourceModelReceipts = []
    sourceReadinessReceipts = []
    sourceProxyReceipts = []
    sourceAnalyzeReceipts = []
    sourceArchiveRows = []
    sourceThroughputSamples = []
    sourceTuningSnapshots = []
    findingScanReads = 0
    sourceLogsRemain = false
    sourceAnalyzeReceiptsRemain = false
    sourceSpecializedReceiptsRemain = false
    fetchHandler = globalThis.fetch
})

afterEach(() => {
    globalThis.fetch = fetchHandler
})

afterAll(() => {
    if (previousSyncToken === undefined) delete process.env.LOGS_SERVICE_SYNC_TOKEN
    else process.env.LOGS_SERVICE_SYNC_TOKEN = previousSyncToken
})

test('reads the Logs-only estimate from PostgreSQL planner output and rejects malformed estimates', () => {
    expect(estimatedPlanRows([{ Plan: { 'Plan Rows': 123 } }])).toBe(123)
    expect(estimatedPlanRows([{ Plan: { 'Plan Rows': -1 } }])).toBeNull()
    expect(estimatedPlanRows(null)).toBeNull()
})

test('builds and verifies the resumable migration cursor index outside a transaction', async () => {
    const calls: string[] = []
    let created = false
    const query = async (sql: string) => {
        calls.push(sql)
        if (sql.includes('FROM pg_index')) return { rows: created ? [{ indisvalid: true, indisready: true,
            definition: 'CREATE INDEX idx_events_logs_migration_cursor ON public.events USING btree (received_at, id) WHERE (ingestion_id = \'logs\'::text)' }] : [] }
        if (sql.startsWith('CREATE INDEX CONCURRENTLY')) created = true
        return { rows: [] }
    }
    await ensureMigrationCursorIndex(query as never)
    expect(calls.some(sql => sql.startsWith('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_logs_migration_cursor'))).toBe(true)
    expect(calls.filter(sql => sql.includes('FROM pg_index'))).toHaveLength(2)
    const dropQuery = async (sql: string) => { calls.push(sql); return { rows: [] } }
    await dropMigrationCursorIndex(dropQuery as never)
    expect(calls.at(-1)).toBe('DROP INDEX CONCURRENTLY IF EXISTS idx_events_logs_migration_cursor')
})

test('deletes source rows only after Logs acknowledges and processes every copied event', async () => {
    let requestBody = ''
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/api/ingest')) {
            expect(String(input)).toBe('https://logs.hanasand.com/api/ingest')
            expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'i'.repeat(40)}`)
            requestBody = String(init?.body)
            return new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 201 })
        }
        expect(String(input)).toBe('https://logs.hanasand.com/api/migration/status')
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'s'.repeat(40)}`)
        return new Response(JSON.stringify({ ok: true, statuses: [{ id: '6a9ac283dd880765ce8d983ac72fb5710b0b8fc61542ec86170f2f2aa89fb8df', status: 'processed' }] }), { status: 200 })
    }) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40))

    expect(result).toEqual({ moved: 1, remaining: true, retry: false })
    expect(JSON.parse(requestBody).events[0]).toMatchObject({
        sourceEventId: 'collector-event-1', metadata: { organizationId: 'tenant-a' },
    })
    const deletion = statements.find(statement => statement.sql.startsWith('DELETE FROM events'))
    expect(JSON.parse(String(deletion?.params[0]))).toEqual([{
        id: 'source-row-1', organization_id: 'tenant-a',
        event_timestamp: '2026-10-20T10:00:00.000Z', normalized: sourceRows[0].normalized,
    }])
})

test('copies linked finding and analyst state before deleting its Hanasand row', async () => {
    sourceFindings = [{ id: 'finding-1', organization_id: 'tenant-a', finding_key: 'tenant-a:rule:event-1',
        rule_id: 'rule', severity: 'high', status: 'investigating', summary: 'Finding', evidence: { key: true },
        event_ids: ['event-1'], first_observed: '2026-10-20T10:00:00Z', last_observed: '2026-10-20T10:00:00Z',
        assignee_id: 'analyst-1', analyst_note: 'reviewed', case_id: 'case-1', case_delivery_attempted_at: null,
        created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z' }]
    referencedRows = [{ id: 'event-1', ingestion_id: 'logs', organization_id: 'tenant-a',
        event_timestamp: '2026-10-20T10:00:00Z', normalized: { source_event_id: 'source-1', service: 'audit', message: 'x' } }]
    let payload: Record<string, unknown> = {}
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('https://logs.hanasand.com/api/migration/findings')
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'s'.repeat(40)}`)
        payload = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 200 })
    }) as typeof fetch

    await migrateFindings('https://logs.hanasand.com', 's'.repeat(40), ['event-1'])

    expect(payload.findings).toMatchObject([{ status: 'investigating', assignee_id: 'analyst-1', analyst_note: 'reviewed', case_id: 'case-1' }])
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM findings'))).toBe(true)
})

test('prepares and acknowledges all linked findings before event ingestion can apply retention drops', async () => {
    sourceFindings = [{ id: 'finding-1', organization_id: 'tenant-a', finding_key: 'tenant-a:rule:event-1',
        rule_id: 'rule', severity: 'high', status: 'investigating', summary: 'Finding', evidence: { key: true },
        event_ids: ['event-1'], first_observed: '2026-10-20T10:00:00Z', last_observed: '2026-10-20T10:00:00Z',
        assignee_id: 'analyst-1', analyst_note: 'reviewed', case_id: 'case-1', case_delivery_attempted_at: null,
        created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z' }]
    referencedRows = [{ id: 'event-1', ingestion_id: 'logs', organization_id: 'tenant-a',
        event_timestamp: '2026-10-20T10:00:00Z', normalized: { source_event_id: 'source-1', service: 'audit', message: 'x' } }]
    const calls: string[] = []
    globalThis.fetch = (async input => {
        calls.push(String(input))
        return new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 200 })
    }) as typeof fetch

    expect(await migrateFindingsBeforeEvents('https://logs.hanasand.com', 's'.repeat(40))).toBe(1)
    expect(calls).toEqual(['https://logs.hanasand.com/api/migration/findings'])
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM findings'))).toBe(true)
    expect(calls.some(url => url.endsWith('/api/ingest'))).toBe(false)
})

test('transfers exact compressed model, readiness and analysis receipts before deleting source rows', async () => {
    sourceModelReceipts = [{ nonce: 'nonce-a', source_event_id: 'event-a', organization_id: 'tenant-a',
        original: Buffer.from('model proof bytes'), original_encoding: 'deflate-json-v1', created_at: '2026-10-20T10:00:00Z' }]
    sourceReadinessReceipts = [{ exec_id: 'exec-a', organization_id: 'tenant-a', root_source_event_id: 'event-b',
        chain_digest: 'digest-b', original: Buffer.from('readiness chain bytes'), original_encoding: 'deflate-json-v1', created_at: '2026-10-20T11:00:00Z' }]
    const analyzeReceipt = { key: 'analyze-a', organization_id: 'tenant-a', rule_id: 'drop.audit.v1',
        rule_version: 'v3', created_at: '2026-10-20T12:00:00Z' }
    sourceAnalyzeReceipts = [analyzeReceipt]
    const sent: Array<{ kind: string, receipts: Array<Record<string, unknown>> }> = []
    globalThis.fetch = (async (input, init) => {
        expect(String(input)).toBe('https://logs.hanasand.com/api/migration/receipts')
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'s'.repeat(40)}`)
        const body = JSON.parse(String(init?.body)) as { kind: string, receipts: Array<Record<string, unknown>> }
        sent.push(body)
        return new Response(JSON.stringify({ ok: true, accepted: body.receipts.length }), { status: 200 })
    }) as typeof fetch

    expect(await migrateAnalysisReceipts('https://logs.hanasand.com', 's'.repeat(40))).toEqual({ modelProbe: 1, readinessAudit: 1, proxy: 0, analyze: 1 })
    expect(statements.find(statement => statement.sql.includes('FROM log_analyze_receipts WHERE key >'))?.params[1]).toBe(2000)
    expect(sent.map(batch => batch.kind)).toEqual(['model_probe', 'readiness_audit', 'analyze'])
    expect(sent[0]?.receipts[0]?.original_base64).toBe(Buffer.from('model proof bytes').toString('base64'))
    expect(sent[1]?.receipts[0]?.original_base64).toBe(Buffer.from('readiness chain bytes').toString('base64'))
    expect(sent[2]?.receipts[0]).toEqual(analyzeReceipt)
    expect(sourceModelReceipts).toHaveLength(0)
    expect(sourceReadinessReceipts).toHaveLength(0)
    expect(sourceAnalyzeReceipts).toHaveLength(0)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_model_probe_receipts'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_readiness_audit_receipts'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_analyze_receipts'))).toBe(true)
    expect(statements.find(statement => statement.sql.startsWith('DELETE FROM log_analyze_receipts'))?.sql).toContain('source.rule_version=expected.rule_version')
})

test('keeps source receipt rows when Logs does not acknowledge the full batch', async () => {
    sourceModelReceipts = [{ nonce: 'nonce-a', source_event_id: 'event-a', organization_id: 'tenant-a',
        original: Buffer.from('model proof bytes'), original_encoding: 'deflate-json-v1', created_at: '2026-10-20T10:00:00Z' }]
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 0 }), { status: 200 })) as typeof fetch
    await expect(migrateReceiptKind('https://logs.hanasand.com', 's'.repeat(40), 'model_probe')).rejects.toThrow('source receipts remain in Hanasand')
    expect(sourceModelReceipts).toHaveLength(1)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_model_probe_receipts'))).toBe(false)
})

test('transfers raw proxy receipt evidence before deleting its source copy', async () => {
    const receipt = { key: 'proxy-key', organization_id: 'tenant-a', connection_id: '8c27aade-5207-4c3b-98a3-1390528b4c69',
        canonical_event_id: 'target-event-1', original: { request: { method: 'GET', path: '/health' }, status: 200 },
        created_at: '2026-10-20T12:00:00Z' }
    sourceProxyReceipts = [receipt]
    let sent: { kind: string, receipts: Array<Record<string, unknown>> } | undefined
    globalThis.fetch = (async (input, init) => {
        expect(String(input)).toBe('https://logs.hanasand.com/api/migration/receipts')
        sent = JSON.parse(String(init?.body)) as typeof sent
        return new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 200 })
    }) as typeof fetch
    expect(await migrateReceiptKind('https://logs.hanasand.com', 's'.repeat(40), 'proxy')).toBe(1)
    expect(sent).toEqual({ kind: 'proxy', receipts: [receipt] })
    expect(sourceProxyReceipts).toHaveLength(0)
})

test('retains analysis receipts if Logs does not acknowledge the exact batch', async () => {
    sourceAnalyzeReceipts = [{ key: 'analyze-a', organization_id: 'tenant-a', rule_id: 'drop.audit.v1',
        rule_version: 'v3', created_at: '2026-10-20T12:00:00Z' }]
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 0 }), { status: 200 })) as typeof fetch
    await expect(migrateReceiptKind('https://logs.hanasand.com', 's'.repeat(40), 'analyze')).rejects.toThrow('source receipts remain in Hanasand')
    expect(sourceAnalyzeReceipts).toHaveLength(1)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_analyze_receipts'))).toBe(false)
})

test('transfers and verifies the full linkage archive row before deleting its source copy', async () => {
    const archiveRow = { organization_id: 'tenant-a', event_id: 'a'.repeat(64), rule_id: 'ssh.audit.v1',
        event_timestamp: '2026-10-20T10:00:00Z', host: 'inspur', process_pid: '123', parent_pid: '100',
        executable: '/usr/bin/sshd', caller_executable: '/usr/sbin/sshd', user_id: '0', login_id: '4294967295',
        audit_id: '42', archived_at: '2026-10-20T10:01:00Z' }
    sourceArchiveRows = [archiveRow]
    let sentRows: Array<Record<string, unknown>> = []
    globalThis.fetch = (async (input, init) => {
        expect(String(input)).toBe('https://logs.hanasand.com/api/migration/linkage-archive')
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'s'.repeat(40)}`)
        sentRows = (JSON.parse(String(init?.body)) as { rows: Array<Record<string, unknown>> }).rows
        return new Response(JSON.stringify({ ok: true, accepted: sentRows.length }), { status: 200 })
    }) as typeof fetch

    expect(await migrateLinkageArchive('https://logs.hanasand.com', 's'.repeat(40))).toBe(1)
    expect(sentRows).toEqual([archiveRow])
    expect(sourceArchiveRows).toHaveLength(0)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_analyze_event_linkage_archive'))).toBe(true)
})

test('transfers throughput history and tuning snapshots before deleting source rows', async () => {
    const sample = { sampled_at: '2026-10-20T10:00:00.123456Z', checked_count: '42', pps: 1.2, eps: 1.4,
        historical_eps: 0.2, npps: 1.1, remaining: '3' }
    const snapshot = { organization_id: 'tenant-a', logs: [{ key: 'ingest', value: 3 }], generated_at: null,
        refresh_requested_at: '2026-10-20T10:00:00.123456Z' }
    sourceThroughputSamples = [sample]
    sourceTuningSnapshots = [snapshot]
    const sent: Array<{ kind: string, rows: Array<Record<string, unknown>> }> = []
    globalThis.fetch = (async (input, init) => {
        expect(String(input)).toBe('https://logs.hanasand.com/api/migration/state')
        sent.push(JSON.parse(String(init?.body)) as { kind: string, rows: Array<Record<string, unknown>> })
        return new Response(JSON.stringify({ ok: true, accepted: sent.at(-1)?.rows.length }), { status: 200 })
    }) as typeof fetch

    expect(await migrateLogRuntimeState('https://logs.hanasand.com', 's'.repeat(40)))
        .toEqual({ throughputSamples: 1, tuningSnapshots: 1 })
    expect(sent).toEqual([{ kind: 'throughput_samples', rows: [sample] }, { kind: 'tuning_snapshots', rows: [snapshot] }])
    expect(sourceThroughputSamples).toHaveLength(0)
    expect(sourceTuningSnapshots).toHaveLength(0)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_throughput_samples'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_tuning_snapshots'))).toBe(true)
})

test('clears only log-owned state after the source log event set is empty and rebuilds shared hit counts', async () => {
    const cleared = await clearMovedLogState()
    expect(cleared).toEqual(['log_analyze_receipts', 'log_dimensions'])
    expect(statements.some(statement => statement.sql.includes('NOT (c.relname=ANY($1::text[]))'))).toBe(true)
    expect(statements.find(statement => statement.sql.includes('NOT (c.relname=ANY($1::text[]))'))?.params[0])
        .toEqual(['log_delivery_outbox', 'log_organization_sync_outbox', 'log_organization_sync_cursor'])
    expect(statements.some(statement => statement.sql.includes('LOCK TABLE events, findings, rule_hit_counts, rule_hit_count_deltas, log_analyze_receipts, log_model_probe_receipts, log_readiness_audit_receipts, log_proxy_receipts'))).toBe(true)
    expect(statements.some(statement => statement.sql === 'TRUNCATE TABLE rule_hit_count_deltas RESTART IDENTITY')).toBe(true)
    expect(statements.some(statement => statement.sql.includes('SELECT organization_id,\'findings\',rule_id,count(*) FROM findings'))).toBe(true)
})

test('refuses to clear log-owned state while any Hanasand Logs event remains', async () => {
    sourceLogsRemain = true
    await expect(clearMovedLogState()).rejects.toThrow('while source log events remain')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('refuses to clear log-owned state while any analysis receipts remain', async () => {
    sourceAnalyzeReceiptsRemain = true
    await expect(clearMovedLogState()).rejects.toThrow('while migration receipts remain')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('refuses to clear log-owned state while specialized migration receipts remain', async () => {
    sourceSpecializedReceiptsRemain = true
    await expect(clearMovedLogState()).rejects.toThrow('while migration receipts remain')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('requires a healthy Logs worker as well as a healthy API before migration', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, worker: { ok: false } }), { status: 200 })) as typeof fetch
    expect(await serviceReady('https://logs.hanasand.com')).toBe(false)
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, worker: { ok: true } }), { status: 200 })) as typeof fetch
    expect(await serviceReady('https://logs.hanasand.com')).toBe(true)
})

test('retains source rows when Logs is busy and asks the caller to retry', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'busy' }), { status: 503 })) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40))

    expect(result).toEqual({ moved: 0, remaining: true, retry: true })
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})

test('retains source rows when Logs accepts but has not processed the batch', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => String(input).endsWith('/api/ingest')
        ? new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 201 })
        : new Response(JSON.stringify({ ok: true, statuses: [{ id: '6a9ac283dd880765ce8d983ac72fb5710b0b8fc61542ec86170f2f2aa89fb8df', status: 'missing' }] }), { status: 200 })) as typeof fetch

    await expect(moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40)))
        .rejects.toThrow('unverified event state (missing)')
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})

test('retains source rows when the acknowledgement count is incomplete', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 0 }), { status: 201 })) as typeof fetch

    await expect(moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40)))
        .rejects.toThrow('did not acknowledge the full migration batch')
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})

test('deletes a source event only after Logs explicitly acknowledges its drop', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        expect(String(input)).toBe('https://logs.hanasand.com/api/ingest')
        return new Response(JSON.stringify({ ok: true, accepted: 1, droppedSourceEventIds: ['collector-event-1'] }), { status: 201 })
    }) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40))
    expect(result).toEqual({ moved: 1, remaining: true, retry: false })
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(true)
})

test('retains source rows when Logs reports an invalid dropped-event identity', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
        ok: true, accepted: 1, droppedSourceEventIds: ['not-in-this-batch'],
    }), { status: 201 })) as typeof fetch

    await expect(moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40)))
        .rejects.toThrow('invalid dropped-event identities')
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})
