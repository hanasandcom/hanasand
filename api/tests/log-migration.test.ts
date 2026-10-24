import { afterAll, afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'

const previousMigrationReserve = process.env.LOGS_MIGRATION_MIN_FREE_BYTES
const previousMigrationStoragePath = process.env.LOGS_MIGRATION_STORAGE_PATH
// Migration tests use mocked database/network state; keep their filesystem guard
// deterministic on developer machines with less than the production 24 GiB reserve.
process.env.LOGS_MIGRATION_MIN_FREE_BYTES = '1'
process.env.LOGS_MIGRATION_STORAGE_PATH = '/'

const sourceRows = [{
    id: 'source-row-1',
    ingestion_id: 'logs',
    organization_id: 'tenant-a',
    source_vendor: null,
    source_product: null,
    event_timestamp: '2026-10-20T10:00:00.000Z',
    received_at: '2026-10-20T10:00:01.000Z',
    event_type: null,
    action: null,
    outcome: null,
    user_id: null,
    user_email: null,
    source_ip: null,
    source_country: null,
    source_city: null,
    device_id: null,
    normalized: {
        source_event_id: 'collector-event-1', service: 'audit', host: 'inspur',
        level: 'info', message: 'process started', timestamp: '2026-10-20T10:00:00.000Z', metadata: {},
    },
    original: null,
    parser_version: null,
    processing_status: null,
}]
const statements: Array<{ sql: string; params: unknown[] }> = []
let sourceFindings: Array<Record<string, unknown>> = []
let referencedRows: Array<Record<string, unknown>> = []
let sourceModelReceipts: Array<Record<string, unknown>> = []
let sourceReadinessReceipts: Array<Record<string, unknown>> = []
let sourceProxyReceipts: Array<Record<string, unknown>> = []
let sourceAnalyzeReceipts: Array<Record<string, unknown>> = []
let sourceAnalyzeReceiptBlocks = new Map<string, number>()
let sourceAnalyzeRelationBytes = 16_384
let sourceAnalyzeBlockSize = 8192
let sourceEventRelationBytes = 16_384
let sourceEventBlockSize = 8192
let sourceArchiveRows: Array<Record<string, unknown>> = []
let sourceThroughputSamples: Array<Record<string, unknown>> = []
let sourceTuningSnapshots: Array<Record<string, unknown>> = []
let sourceAccessCounts: Array<Record<string, unknown>> = []
let sourceIngestionCanonical: Array<Record<string, unknown>> = []
let sourceIngestionCopies: Array<Record<string, unknown>> = []
let sourceRuntimeState: Record<string, Array<Record<string, unknown>>> = {}
let selectedRowsOverride: Array<Record<string, unknown>> | null = null
let physicalEventRowsOverride: Array<Record<string, unknown>> | null = null
let sourceDeleteRowsOverride: Array<Record<string, unknown>> | null = null
let sourceDeleteMismatchTable: string | null = null
let transactionErrors = 0
let findingScanReads = 0
let sourceLogsRemain = false
let sourceOtherEventsRemain = false
let sourceFindingsRemain = false
let sourceAnalyzeReceiptsRemain = false
let sourceSpecializedReceiptsRemain = false
let sourceLogOutboxRemain = false
let discoveredLogTables = ['log_analyze_receipts', 'log_dimensions']
let fetchHandler: typeof fetch
const compareCtids = (left: string, right: string) => {
    const leftTid = /^\((\d+),(\d+)\)$/.exec(left)
    const rightTid = /^\((\d+),(\d+)\)$/.exec(right)
    if (!leftTid || !rightTid) throw new Error('Invalid test ctid.')
    return Number(leftTid[1]) - Number(rightTid[1]) || Number(leftTid[2]) - Number(rightTid[2])
}
const previousSyncToken = process.env.LOGS_SERVICE_SYNC_TOKEN
const previousReadinessUrl = process.env.LOGS_FRONTEND_READINESS_URL
process.env.LOGS_SERVICE_SYNC_TOKEN = 's'.repeat(40)
const query = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params })
    if (sql.includes('SELECT id FROM events') && sql.includes('id > $1')) {
        findingScanReads++
        return { rows: findingScanReads === 1 ? [{ id: 'source-row-1' }] : [] }
    }
    if (sql.includes('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id') && sql.includes('\'logs\'')) return { rows: [{ present: sourceLogsRemain }] }
    if (sql.includes('pg_relation_size(\'public.events\')')) return { rows: [{ bytes: sourceEventRelationBytes, block_size: sourceEventBlockSize }] }
    if (sql.includes('SELECT EXISTS(SELECT 1 FROM events') && sql.includes('ctid >=')) return { rows: [{ present: sourceLogsRemain }] }
    if (sql === 'SELECT EXISTS(SELECT 1 FROM public.log_access_counts) AS present') return { rows: [{ present: sourceAccessCounts.length > 0 }] }
    if (sql === 'SELECT EXISTS(SELECT 1 FROM events) AS present') return { rows: [{ present: sourceOtherEventsRemain }] }
    if (sql === 'SELECT EXISTS(SELECT 1 FROM findings) AS present') return { rows: [{ present: sourceFindingsRemain }] }
    if (sql.includes('SELECT EXISTS(SELECT 1 FROM log_analyze_receipts)')) {
        return { rows: [{ present: sourceAnalyzeReceiptsRemain || sourceSpecializedReceiptsRemain }] }
    }
    if (sql.includes('pg_relation_size(\'public.log_analyze_receipts\')')) {
        return { rows: [{ bytes: sourceAnalyzeRelationBytes, block_size: sourceAnalyzeBlockSize }] }
    }
    if (sql.startsWith('SELECT EXISTS(SELECT 1 FROM log_analyze_receipts') && sql.includes('ctid >=')) {
        return { rows: [{ present: sourceAnalyzeReceipts.some(row => {
            const block = sourceAnalyzeReceiptBlocks.get(String(row.key)) ?? 0
            return block >= Number(params[0]) && block < Number(params[1])
        }) }] }
    }
    if (sql.startsWith('SELECT key,organization_id,rule_id,rule_version,created_at::text AS created_at FROM log_analyze_receipts')
        && sql.includes('ctid >=')) {
        return { rows: sourceAnalyzeReceipts
            .filter(row => (sourceAnalyzeReceiptBlocks.get(String(row.key)) ?? 0) >= Number(params[0])
                && (sourceAnalyzeReceiptBlocks.get(String(row.key)) ?? 0) < Number(params[1]))
            .slice(0, Number(params[2])) }
    }
    if (sql.startsWith('SELECT ctid::text AS source_ctid, id, ingestion_id') && sql.includes('FROM events') && sql.includes('ctid >=')) {
        return { rows: physicalEventRowsOverride ?? [] }
    }
    if (sql.includes('FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace')) {
        return { rows: discoveredLogTables.map(relname => ({ relname })) }
    }
    if (sql.includes('SELECT EXISTS(SELECT 1 FROM public.log_delivery_outbox)')) return { rows: [{ present: sourceLogOutboxRemain }] }
    if (sql.includes('FROM events WHERE ingestion_id = \'logs\'')) {
        return { rows: selectedRowsOverride ?? sourceRows.filter(row => String(row.id) > String(params[0])).slice(0, Number(params[1])) }
    }
    if (sql.includes('FROM findings WHERE event_ids')) return { rows: sourceFindings }
    if (sql.includes('FROM events WHERE id=ANY')) return { rows: referencedRows }
    if (sql.includes('FROM log_model_probe_receipts WHERE nonce >')) return { rows: sourceModelReceipts.filter(row => String(row.nonce) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_readiness_audit_receipts WHERE exec_id >')) return { rows: sourceReadinessReceipts.filter(row => String(row.exec_id) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_proxy_receipts WHERE key >')) return { rows: sourceProxyReceipts.filter(row => String(row.key) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_analyze_receipts WHERE key >')) return { rows: sourceAnalyzeReceipts.filter(row => String(row.key) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_throughput_samples WHERE sampled_at::text>$1')) return { rows: sourceThroughputSamples.filter(row => String(row.sampled_at) > String(params[0])).slice(0, 500) }
    if (sql.includes('FROM log_tuning_snapshots WHERE organization_id>$1')) return { rows: sourceTuningSnapshots.filter(row => String(row.organization_id) > String(params[0])).slice(0, 200) }
    if (sql.includes('FROM log_access_counts ORDER BY organization_id,ip,day')) return { rows: sourceAccessCounts.slice(0, Number(params[0])) }
    if (sql.includes('FROM log_ingestion_canonical WHERE key>$1')) return { rows: sourceIngestionCanonical.filter(row => String(row.key) > String(params[0])).slice(0, Number(params[1])) }
    if (sql.includes('FROM log_ingestion_copies ORDER BY key')) return { rows: sourceIngestionCopies.slice(0, Number(params[0])) }
    for (const [table, rows] of Object.entries(sourceRuntimeState)) {
        if (sql.startsWith('SELECT') && sql.includes(`FROM ${table}`)) return { rows: rows.slice(0, Number(params.at(-1))) }
    }
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
        const returned = sourceDeleteMismatchTable === 'log_analyze_event_linkage_archive' ? deleted.slice(0, -1) : deleted
        const deletedIds = new Set(returned.map(row => `${row.organization_id}:${row.event_id}`))
        sourceArchiveRows = sourceArchiveRows.filter(row => !deletedIds.has(`${row.organization_id}:${row.event_id}`))
        return { rows: returned }
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
        const returned = sourceDeleteMismatchTable === 'log_throughput_samples' ? deleted.slice(0, -1) : deleted
        const deletedIds = new Set(returned.map(row => String(row.sampled_at)))
        sourceThroughputSamples = sourceThroughputSamples.filter(row => !deletedIds.has(String(row.sampled_at)))
        return { rows: returned }
    }
    if (sql.startsWith('DELETE FROM log_tuning_snapshots')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.organization_id)))
        const deleted = sourceTuningSnapshots.filter(row => ids.has(String(row.organization_id)))
        const returned = sourceDeleteMismatchTable === 'log_tuning_snapshots' ? deleted.slice(0, -1) : deleted
        const deletedIds = new Set(returned.map(row => String(row.organization_id)))
        sourceTuningSnapshots = sourceTuningSnapshots.filter(row => !deletedIds.has(String(row.organization_id)))
        return { rows: returned }
    }
    if (sql.startsWith('DELETE FROM log_access_counts')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => JSON.stringify([row.organization_id, row.ip, row.day])))
        const deleted = sourceAccessCounts.filter(row => ids.has(JSON.stringify([row.organization_id, row.ip, row.day])))
        sourceAccessCounts = sourceAccessCounts.filter(row => !ids.has(JSON.stringify([row.organization_id, row.ip, row.day])))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM log_ingestion_copies')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.key)))
        const deleted = sourceIngestionCopies.filter(row => ids.has(String(row.key)))
        sourceIngestionCopies = sourceIngestionCopies.filter(row => !ids.has(String(row.key)))
        return { rows: deleted }
    }
    if (sql.startsWith('DELETE FROM log_ingestion_canonical')) {
        const rows = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
        const ids = new Set(rows.map(row => String(row.key)))
        const deleted = sourceIngestionCanonical.filter(row => ids.has(String(row.key)))
        sourceIngestionCanonical = sourceIngestionCanonical.filter(row => !ids.has(String(row.key)))
        return { rows: deleted }
    }
    for (const [table, rows] of Object.entries(sourceRuntimeState)) {
        if (sql.startsWith(`DELETE FROM ${table} AS source`)) {
            const batch = JSON.parse(String(params[0])) as Array<Record<string, unknown>>
            const deleted = rows.slice(0, batch.length)
            sourceRuntimeState[table] = rows.slice(batch.length)
            return { rows: deleted }
        }
    }
    if (sql.startsWith('DELETE FROM events')) return { rows: sourceDeleteRowsOverride ?? sourceRows.map(row => ({ id: row.id })) }
    if (sql.startsWith('DELETE FROM findings')) return { rows: sourceFindings.map(row => ({ id: row.id })) }
    return { rows: [] }
}

mock.module('#db', () => ({
    queryOnce: async () => ({ rows: [] }),
    withTransaction: async (work: (tx: typeof query) => unknown) => {
        const stateBefore = structuredClone({ sourceArchiveRows, sourceThroughputSamples, sourceTuningSnapshots })
        try { return await work(query) }
        catch (error) {
            sourceArchiveRows = stateBefore.sourceArchiveRows
            sourceThroughputSamples = stateBefore.sourceThroughputSamples
            sourceTuningSnapshots = stateBefore.sourceTuningSnapshots
            transactionErrors++
            throw error
        }
    },
}))

const { assertMigrationCollectorReady, assertMigrationStorageReserve, clearMigratedLogReceipts, clearMovedLogState, customerLogsReadReady, estimatedPlanRows, migrateAnalysisReceipts, migrateEventsByPhysicalTail, migrateFindings, migrateFindingsBeforeEvents, migrateLinkageArchive, migrateLogRuntimeState, migrateReceiptKind, migrationCollectorReady, migrationPayloadHash, migrationStoragePathsFromDockerInspect, moveOneBatch, resolveMigrationStoragePaths, serviceReady } = await import('../scripts/migrate-logs-to-service.ts')
const { logMigrationEvent } = await import('../src/utils/logs/logMigrationEvent.ts')

beforeEach(() => {
    statements.length = 0
    sourceFindings = []
    referencedRows = []
    sourceModelReceipts = []
    sourceReadinessReceipts = []
    sourceProxyReceipts = []
    sourceAnalyzeReceipts = []
    sourceAnalyzeReceiptBlocks = new Map()
    sourceAnalyzeRelationBytes = 16_384
    sourceAnalyzeBlockSize = 8192
    sourceEventRelationBytes = 16_384
    sourceEventBlockSize = 8192
    sourceArchiveRows = []
    sourceThroughputSamples = []
    sourceTuningSnapshots = []
    sourceAccessCounts = []
    sourceIngestionCanonical = []
    sourceIngestionCopies = []
    sourceRuntimeState = {}
    selectedRowsOverride = null
    physicalEventRowsOverride = null
    sourceDeleteRowsOverride = null
    sourceDeleteMismatchTable = null
    transactionErrors = 0
    findingScanReads = 0
    sourceLogsRemain = false
    sourceOtherEventsRemain = false
    sourceFindingsRemain = false
    sourceAnalyzeReceiptsRemain = false
    sourceSpecializedReceiptsRemain = false
    sourceLogOutboxRemain = false
    discoveredLogTables = ['log_analyze_receipts', 'log_dimensions']
    fetchHandler = globalThis.fetch
})

afterEach(() => {
    globalThis.fetch = fetchHandler
})

afterAll(() => {
    if (previousSyncToken === undefined) delete process.env.LOGS_SERVICE_SYNC_TOKEN
    else process.env.LOGS_SERVICE_SYNC_TOKEN = previousSyncToken
    if (previousReadinessUrl === undefined) delete process.env.LOGS_FRONTEND_READINESS_URL
    else process.env.LOGS_FRONTEND_READINESS_URL = previousReadinessUrl
    if (previousMigrationReserve === undefined) delete process.env.LOGS_MIGRATION_MIN_FREE_BYTES
    else process.env.LOGS_MIGRATION_MIN_FREE_BYTES = previousMigrationReserve
    if (previousMigrationStoragePath === undefined) delete process.env.LOGS_MIGRATION_STORAGE_PATH
    else process.env.LOGS_MIGRATION_STORAGE_PATH = previousMigrationStoragePath
})

test('reads the Logs-only estimate from PostgreSQL planner output and rejects malformed estimates', () => {
    expect(estimatedPlanRows([{ Plan: { 'Plan Rows': 123 } }])).toBe(123)
    expect(estimatedPlanRows([{ Plan: { 'Plan Rows': -1 } }])).toBeNull()
    expect(estimatedPlanRows(null)).toBeNull()
})

test('pauses every migration batch below the filesystem reserve and reports available bytes above it', async () => {
    const reserve = 24 * 1024 ** 3
    const checkedPaths: string[] = []
    await expect(assertMigrationStorageReserve(async () => 1, reserve, ['/source', '/target']))
        .rejects.toThrow('a PostgreSQL data/WAL filesystem is below the 24 GiB reserve')
    await expect(assertMigrationStorageReserve(async () => Number.NaN, reserve, ['/source', '/target']))
        .rejects.toThrow('a PostgreSQL data/WAL filesystem is below the 24 GiB reserve')
    await expect(assertMigrationStorageReserve(async storagePath => {
        checkedPaths.push(storagePath)
        return 32 * 1024 ** 3
    }, reserve, ['/source', '/target']))
        .resolves.toEqual(['/source', '/target'])
    expect(checkedPaths).toEqual(['/source', '/target'])
})

test('requires fresh collector sources and a recent live acknowledgement before migration', async () => {
    const now = Date.now()
    const health = {
        checkedAt: new Date(now).toISOString(),
        collector_health: { audit: true, journal: true, docker: true, docker_file_live: true, docker_file_history: true },
        source_status: {
            journal_live: { ok: true, checkedAt: new Date(now).toISOString() },
            audit_live: { ok: true, checkedAt: new Date(now).toISOString() },
            docker: { ok: true, checkedAt: new Date(now).toISOString() },
            docker_file_live: { ok: true, checkedAt: new Date(now).toISOString() },
            docker_file_history: { ok: true, checkedAt: new Date(now).toISOString() },
            delivery_live: { ok: false, checkedAt: new Date(now).toISOString(), lastAcknowledgedAt: new Date(now).toISOString(), accepted: 110 },
        },
    }
    expect(migrationCollectorReady(health, now)).toBe(true)
    expect(migrationCollectorReady({ ...health, checkedAt: new Date(now - 121_000).toISOString() }, now)).toBe(false)
    expect(migrationCollectorReady({ ...health, source_status: { ...health.source_status,
        delivery_live: { ...health.source_status.delivery_live, lastAcknowledgedAt: new Date(now - 121_000).toISOString() } } }, now)).toBe(false)
    expect(migrationCollectorReady({ ...health, source_status: { ...health.source_status,
        docker: { ...health.source_status.docker, checkedAt: new Date(now - 121_000).toISOString() } } }, now)).toBe(false)
    expect(migrationCollectorReady({ ...health, source_status: { ...health.source_status,
        journal_live: { ok: true } } }, now)).toBe(false)
    await expect(assertMigrationCollectorReady(async () => JSON.stringify({})))
        .rejects.toThrow('collector sources or its recent live Logs acknowledgement are not healthy')
})

test('resolves both PostgreSQL data volumes and any separately mounted WAL directory', () => {
    const paths = migrationStoragePathsFromDockerInspect([
        { Name: '/hanasand_database', Config: { Env: [] }, Mounts: [
            { Destination: '/var/lib/postgresql/data', Source: '/var/lib/docker/volumes/hanasand/_data' },
            { Destination: '/var/lib/postgresql/data/pg_wal', Source: '/mnt/hanasand-wal' },
        ] },
        { Name: '/logs_database', Config: { Env: ['PGDATA=/var/lib/postgresql/data/pgdata'] }, Mounts: [
            { Destination: '/var/lib/postgresql/data', Source: '/var/lib/docker/volumes/logs/_data' },
        ] },
    ], ['hanasand_database', 'logs_database'])
    expect(paths).toEqual(['/var/lib/docker/volumes/hanasand/_data', '/mnt/hanasand-wal', '/var/lib/docker/volumes/logs/_data'])
})

test('inspects the configured database containers and fails closed when Docker cannot verify their mounts', () => {
    const names = ['hanasand_database', 'logs_database']
    const containers = [
        { Name: '/hanasand_database', Mounts: [{ Destination: '/var/lib/postgresql/data', Source: '/docker/hanasand' }] },
        { Name: '/logs_database', Config: { Env: ['PGDATA=/var/lib/postgresql/data/pgdata'] }, Mounts: [{ Destination: '/var/lib/postgresql/data', Source: '/docker/logs' }] },
    ]
    let inspectedNames: string[] = []
    expect(resolveMigrationStoragePaths(undefined, names, values => {
        inspectedNames = values
        return containers
    })).toEqual(['/docker/hanasand', '/docker/logs'])
    expect(inspectedNames).toEqual(names)

    expect(() => resolveMigrationStoragePaths(undefined, names, () => { throw new Error('docker unavailable') }))
        .toThrow('Docker could not verify the Hanasand and Logs database volumes')
    expect(() => resolveMigrationStoragePaths(undefined, names, () => containers.slice(0, 1)))
        .toThrow('a PostgreSQL container could not be inspected')
    expect(() => resolveMigrationStoragePaths(undefined, names, () => [
        containers[0], { ...containers[1], Mounts: [] },
    ])).toThrow('PostgreSQL data volume is not mounted at a verifiable host path')
})

test('accepts only absolute override storage paths without invoking Docker', () => {
    const inspect = () => { throw new Error('Docker must not be called for an explicit override') }
    expect(resolveMigrationStoragePaths('/source,/target', ['hanasand_database', 'logs_database'], inspect))
        .toEqual(['/source', '/target'])
    expect(() => resolveMigrationStoragePaths('relative/path', ['hanasand_database'], inspect))
        .toThrow('LOGS_MIGRATION_STORAGE_PATH must list absolute PostgreSQL storage paths')
})

test('requires an accepting Logs API, matching healthy worker, and configured app-log HMAC key before migration', async () => {
    const previousKey = process.env.LOGS_APPLICATION_LOG_HMAC_KEY
    process.env.LOGS_APPLICATION_LOG_HMAC_KEY = 'synthetic-migration-signing-key-at-least-32-bytes'
    try {
        const expectedKeyId = createHash('sha256').update(process.env.LOGS_APPLICATION_LOG_HMAC_KEY).digest('hex').slice(0, 24)
        const health = { ok: true, accepting: true, release: 'logs-release', applicationLogHmacReady: true, applicationLogHmacKeyId: expectedKeyId, worker: { ok: true, release: 'logs-release' } }
        globalThis.fetch = (async () => new Response(JSON.stringify({ ...health, worker: { ...health.worker, ok: false } }), { status: 200 })) as typeof fetch
        expect(await serviceReady('https://logs.hanasand.com')).toBe(false)

        globalThis.fetch = (async () => new Response(JSON.stringify({ ...health, worker: { ...health.worker, release: 'older-worker' } }), { status: 200 })) as typeof fetch
        expect(await serviceReady('https://logs.hanasand.com')).toBe(false)

        globalThis.fetch = (async () => new Response(JSON.stringify(health), { status: 200 })) as typeof fetch
        expect(await serviceReady('https://logs.hanasand.com')).toBe(true)

        globalThis.fetch = (async () => new Response(JSON.stringify({ ...health, applicationLogHmacReady: false }), { status: 200 })) as typeof fetch
        expect(await serviceReady('https://logs.hanasand.com')).toBe(false)

        globalThis.fetch = (async () => new Response(JSON.stringify({ ...health, applicationLogHmacKeyId: '0'.repeat(24) }), { status: 200 })) as typeof fetch
        expect(await serviceReady('https://logs.hanasand.com')).toBe(false)
    } finally {
        if (previousKey === undefined) delete process.env.LOGS_APPLICATION_LOG_HMAC_KEY
        else process.env.LOGS_APPLICATION_LOG_HMAC_KEY = previousKey
    }
})

test('requires the public frontend read target and all direct Logs routes before migration', async () => {
    process.env.LOGS_FRONTEND_READINESS_URL = 'https://hanasand.com/api/health'
    const responses = [
        new Response(JSON.stringify({ ok: true, service: 'frontend', logsReadBaseUrl: 'https://logs.hanasand.com/api' }), { status: 200 }),
        ...Array.from({ length: 9 }, () => new Response('{}', { status: 401 })),
    ]
    const requests: RequestInit[] = []
    globalThis.fetch = (async (_input, init) => {
        requests.push(init || {})
        return responses.shift()!
    }) as typeof fetch

    expect(await customerLogsReadReady('https://logs.hanasand.com')).toBe(true)
    expect(responses).toHaveLength(0)
    expect(requests.slice(-5).map(request => request.method)).toEqual(Array.from({ length: 5 }, () => 'POST'))
    expect(requests.slice(-5).every(request => String(new Headers(request.headers).get('authorization')).startsWith('Bearer ')
        && String(request.body) === '{}')).toBe(true)
})

test('blocks migration when the public frontend does not route Logs reads to the target service', async () => {
    process.env.LOGS_FRONTEND_READINESS_URL = 'https://hanasand.com/api/health'
    let requests = 0
    globalThis.fetch = (async () => {
        requests++
        return new Response(JSON.stringify({ ok: true, service: 'frontend', logsReadBaseUrl: null }), { status: 200 })
    }) as typeof fetch

    expect(await customerLogsReadReady('https://logs.hanasand.com')).toBe(false)
    expect(requests).toBe(1)
})

test('blocks migration if any direct Logs read route is missing', async () => {
    process.env.LOGS_FRONTEND_READINESS_URL = 'https://hanasand.com/api/health'
    const responses = [
        new Response(JSON.stringify({ ok: true, service: 'frontend', logsReadBaseUrl: 'https://logs.hanasand.com/api' }), { status: 200 }),
        new Response('{}', { status: 401 }),
        new Response('{}', { status: 401 }),
        new Response('{}', { status: 404 }),
        new Response('{}', { status: 401 }),
    ]
    globalThis.fetch = (async () => responses.shift()!) as typeof fetch

    expect(await customerLogsReadReady('https://logs.hanasand.com')).toBe(false)
})

test('blocks migration before writes if an OpenResty migration POST route is missing', async () => {
    process.env.LOGS_FRONTEND_READINESS_URL = 'https://hanasand.com/api/health'
    const responses = [
        new Response(JSON.stringify({ ok: true, service: 'frontend', logsReadBaseUrl: 'https://logs.hanasand.com/api' }), { status: 200 }),
        ...Array.from({ length: 4 }, () => new Response('{}', { status: 401 })),
        ...Array.from({ length: 4 }, () => new Response('{}', { status: 401 })),
        new Response('{}', { status: 404 }),
    ]
    globalThis.fetch = (async () => responses.shift()!) as typeof fetch

    expect(await customerLogsReadReady('https://logs.hanasand.com')).toBe(false)
})

test('deletes source rows only after Logs durably stores and verifies every copied event', async () => {
    let requestBody = ''
    const payloadSha256 = migrationPayloadHash(logMigrationEvent(sourceRows[0]))
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/api/ingest')) {
            expect(String(input)).toBe('https://logs.hanasand.com/api/ingest')
            expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'i'.repeat(40)}`)
            requestBody = String(init?.body)
            return new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 201 })
        }
        expect(String(input)).toBe('https://logs.hanasand.com/api/migration/status')
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'s'.repeat(40)}`)
        return new Response(JSON.stringify({ ok: true, statuses: [{ id: '6a9ac283dd880765ce8d983ac72fb5710b0b8fc61542ec86170f2f2aa89fb8df', status: 'processed', payloadSha256 }] }), { status: 200 })
    }) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40), 'source-row-0')

    expect(result).toEqual({ moved: 1, remaining: true, retry: false, cursor: 'source-row-1' })
    expect(JSON.parse(requestBody).events[0]).toMatchObject({
        sourceEventId: 'collector-event-1', metadata: { organizationId: 'tenant-a' },
    })
    const deletion = statements.find(statement => statement.sql.startsWith('DELETE FROM events'))
    const selection = statements.find(statement => statement.sql.includes('FROM events WHERE ingestion_id = \'logs\''))
    expect(selection?.sql).toContain('id > $1')
    expect(selection?.sql).toContain('ORDER BY id LIMIT $2')
    expect(selection?.sql).not.toContain('ORDER BY received_at')
    expect(selection?.params).toEqual(['source-row-0', 200])
    expect(JSON.parse(String(deletion?.params[0]))).toEqual([{
        ...sourceRows[0], event_timestamp: '2026-10-20T10:00:00.000Z',
    }])
    for (const column of ['source_vendor', 'source_product', 'event_type', 'action', 'outcome',
        'user_id', 'user_email', 'source_ip', 'source_country', 'source_city', 'device_id', 'original',
        'parser_version', 'processing_status']) {
        expect(deletion?.sql).toContain(`source.${column} IS NOT DISTINCT FROM expected.${column}`)
    }
    expect(deletion?.sql).toContain('source.received_at=expected.received_at')
    expect(deletion?.sql).toContain('source.normalized=expected.normalized')
})

test('selects event batches inside the requested physical tail range', async () => {
    physicalEventRowsOverride = [{ ...sourceRows[0], source_ctid: '(8,3)' }]
    const payloadSha256 = migrationPayloadHash(logMigrationEvent(sourceRows[0]))
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 1,
        droppedSourceEventIds: ['collector-event-1'],
        droppedEvents: [{ sourceEventId: 'collector-event-1', payloadSha256 }] }), { status: 201 })) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40), '', { lowerBlock: 8, upperBlock: 12 })

    const selection = statements.find(statement => statement.sql.startsWith('SELECT ctid::text AS source_ctid, id, ingestion_id') && statement.sql.includes('ctid >='))
    expect(result).toMatchObject({ moved: 1, retry: false, tailCursor: '(8,3)' })
    expect(selection?.sql).toContain('ORDER BY ctid LIMIT $4')
    expect(selection?.params).toEqual([8, 12, null, 200])
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(true)
})

test('restarts a full sweep when unprocessed source rows remain behind the current cursor', async () => {
    selectedRowsOverride = []
    sourceLogsRemain = true
    let remoteCalls = 0
    globalThis.fetch = (async () => {
        remoteCalls++
        return new Response('{}', { status: 500 })
    }) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40), 'source-row-z')

    expect(result).toEqual({ moved: 0, remaining: true, retry: false, cursor: '' })
    expect(remoteCalls).toBe(0)
    expect(statements.some(statement => statement.sql.includes('id > $1') && statement.sql.includes('ORDER BY id LIMIT $2'))).toBe(true)
})

test('deletes a source row only after Logs durably acknowledges its drop-rule receipt', async () => {
    let statusQueried = false
    const payloadSha256 = migrationPayloadHash(logMigrationEvent(sourceRows[0]))
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/api/migration/status')) statusQueried = true
        expect(String(input)).toBe('https://logs.hanasand.com/api/ingest')
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${'i'.repeat(40)}`)
        expect(JSON.parse(String(init?.body))).toMatchObject({ events: [{ sourceEventId: 'collector-event-1' }] })
        return new Response(JSON.stringify({ ok: true, accepted: 1, droppedSourceEventIds: ['collector-event-1'],
            droppedEvents: [{ sourceEventId: 'collector-event-1', payloadSha256 }] }), { status: 201 })
    }) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40))

    expect(result).toEqual({ moved: 1, remaining: true, retry: false, cursor: 'source-row-1' })
    expect(statusQueried).toBe(false)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(true)
})

test('retains source rows when Logs reports a processed event with a different payload hash', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => String(input).endsWith('/api/ingest')
        ? new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 201 })
        : new Response(JSON.stringify({ ok: true, statuses: [{ id: '6a9ac283dd880765ce8d983ac72fb5710b0b8fc61542ec86170f2f2aa89fb8df',
            status: 'processed', payloadSha256: '0'.repeat(64) }] }), { status: 200 })) as typeof fetch

    await expect(moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40)))
        .rejects.toThrow('mismatched source payload hashes')
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})

test('retains source rows when Logs omits the payload proof for a dropped event', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 1, droppedSourceEventIds: ['collector-event-1'] }), { status: 201 })) as typeof fetch

    await expect(moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40)))
        .rejects.toThrow('missing or mismatched drop payload proofs')
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})

test('rolls back a partially matched source-event delete inside its transaction', async () => {
    const secondRow = {
        ...sourceRows[0], id: 'source-row-2', normalized: { ...sourceRows[0].normalized, source_event_id: 'collector-event-2' },
    }
    selectedRowsOverride = [sourceRows[0], secondRow]
    sourceDeleteRowsOverride = [{ id: 'source-row-1' }]
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 2,
        droppedSourceEventIds: ['collector-event-1', 'collector-event-2'], droppedEvents: [
            { sourceEventId: 'collector-event-1', payloadSha256: migrationPayloadHash(logMigrationEvent(sourceRows[0])) },
            { sourceEventId: 'collector-event-2', payloadSha256: migrationPayloadHash(logMigrationEvent(secondRow)) },
        ] }), { status: 201 })) as typeof fetch

    await expect(moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40)))
        .rejects.toThrow('source event batch changed before it could be removed')

    expect(transactionErrors).toBe(1)
})

test('retains source rows if Logs reports a dropped event outside the acknowledged batch', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 1, droppedSourceEventIds: ['other-event'] }), { status: 201 })) as typeof fetch

    await expect(moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40)))
        .rejects.toThrow('invalid dropped-event identities')
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
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

test('transfers exact compressed model, readiness and general analysis receipts before deleting source rows', async () => {
    sourceModelReceipts = [{ nonce: 'nonce-a', source_event_id: 'event-a', organization_id: 'tenant-a',
        original: Buffer.from('model proof bytes'), original_encoding: 'deflate-json-v1', created_at: '2026-10-20T10:00:00Z' }]
    sourceReadinessReceipts = [{ exec_id: 'exec-a', organization_id: 'tenant-a', root_source_event_id: 'event-b',
        chain_digest: 'digest-b', original: Buffer.from('readiness chain bytes'), original_encoding: 'deflate-json-v1', created_at: '2026-10-20T11:00:00Z' }]
    const analyzeReceipt = { key: 'a'.repeat(64), organization_id: 'tenant-a', rule_id: 'drop.audit.v1',
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

    const vacuumed: string[] = []
    expect(await migrateAnalysisReceipts('https://logs.hanasand.com', 's'.repeat(40), table => vacuumed.push(table)))
        .toEqual({ modelProbe: 1, readinessAudit: 1, proxy: 0, analyze: 1 })
    expect(statements.find(statement => statement.sql.startsWith('SELECT key,organization_id,rule_id,rule_version,created_at::text AS created_at FROM log_analyze_receipts')
        && statement.sql.includes('FROM log_analyze_receipts') && statement.sql.includes('ctid >='))?.params)
        .toEqual([0, 2, 20_000])
    expect(vacuumed).toEqual(['log_analyze_receipts'])
    expect(sent.map(batch => batch.kind)).toEqual(['model_probe', 'readiness_audit', 'analyze'])
    expect(sent[0]?.receipts[0]?.original_base64).toBe(Buffer.from('model proof bytes').toString('base64'))
    expect(sent[1]?.receipts[0]?.original_base64).toBe(Buffer.from('readiness chain bytes').toString('base64'))
    expect(sent[2]?.receipts[0]).toEqual(analyzeReceipt)
    expect(sourceModelReceipts).toHaveLength(0)
    expect(sourceReadinessReceipts).toHaveLength(0)
    expect(sourceAnalyzeReceipts).toHaveLength(0)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_model_probe_receipts'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_readiness_audit_receipts'))).toBe(true)
    expect(statements.find(statement => statement.sql.startsWith('DELETE FROM log_analyze_receipts'))?.sql).toContain('source.rule_version=expected.rule_version')
})

test('selects descending bounded physical tail ranges and builds lock-bounded vacuum commands', async () => {
    const { migrationTailPageRange, migrationTailVacuumArgs, migrationTailVacuumInterval } = await import('../scripts/migrate-logs-to-service.ts')
    expect(migrationTailVacuumInterval(undefined)).toBe(16 * 1024 ** 3)
    expect(migrationTailVacuumInterval(String(4 * 1024 ** 3))).toBe(4 * 1024 ** 3)
    expect(() => migrationTailVacuumInterval(String(1024 ** 3))).toThrow('must be an integer of at least')
    expect(migrationTailPageRange(64 * 1024, 8192, undefined, 16 * 1024)).toEqual({ lowerBlock: 6, upperBlock: 8 })
    expect(migrationTailPageRange(64 * 1024, 8192, 6, 16 * 1024)).toEqual({ lowerBlock: 4, upperBlock: 6 })
    expect(migrationTailPageRange(64 * 1024, 8192, 2, 16 * 1024)).toEqual({ lowerBlock: 0, upperBlock: 2 })
    expect(migrationTailVacuumArgs('hanasand_database', 'postgres', 'hanasand', 'log_analyze_receipts'))
        .toContain('SET lock_timeout = \'1s\'')
    expect(migrationTailVacuumArgs('hanasand_database', 'postgres', 'hanasand', 'log_analyze_receipts'))
        .toContain('SET statement_timeout = \'20min\'')
    expect(migrationTailVacuumArgs('hanasand_database', 'postgres', 'hanasand', 'log_analyze_receipts').at(-1))
        .toBe('VACUUM (TRUNCATE) public.log_analyze_receipts')
    expect(migrationTailVacuumArgs('hanasand_database', 'postgres', 'hanasand', 'events').at(-1))
        .toBe('VACUUM (TRUNCATE) public.events')
})

test('orders physical tuple cursors numerically across multi-digit page numbers', () => {
    expect(compareCtids('(10,1)', '(9,1)')).toBeGreaterThan(0)
    expect(compareCtids('(10,2)', '(10,1)')).toBeGreaterThan(0)
})

test('walks empty event heap ranges from the tail down and vacuums each completed range', async () => {
    sourceEventRelationBytes = 49_152
    sourceEventBlockSize = 8192
    const vacuumed: string[] = []

    expect(await migrateEventsByPhysicalTail('https://logs.hanasand.com', 'i'.repeat(40), table => vacuumed.push(table), 16_384, 32_768, async () => {}))
        .toBe(0)
    expect(statements.filter(statement => statement.sql.includes('pg_relation_size(\'public.events\')'))).toHaveLength(1)
    expect(statements.filter(statement => statement.sql.startsWith('SELECT ctid::text AS source_ctid, id, ingestion_id') && statement.sql.includes('ctid >='))
        .map(statement => statement.params)).toEqual([[4, 6, null, 200], [2, 4, null, 200], [0, 2, null, 200]])
    expect(vacuumed).toEqual(['events', 'events'])
})

test('stops the physical event sweep if Inspur collector readiness goes stale', async () => {
    sourceEventRelationBytes = 8192
    await expect(migrateEventsByPhysicalTail('https://logs.hanasand.com', 'i'.repeat(40), undefined, undefined, undefined,
        async () => { throw new Error('collector health expired') }))
        .rejects.toThrow('collector health expired')
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})

test('moves receipt batches from the physical tail downward and vacuums only after range acknowledgements', async () => {
    sourceAnalyzeRelationBytes = 32_768
    sourceAnalyzeBlockSize = 8192
    const oldest = { key: 'a'.repeat(64), organization_id: 'tenant-a', rule_id: 'drop.audit.v1', rule_version: 'v3', created_at: '2026-10-20T10:00:00Z' }
    const newest = { key: 'z'.repeat(64), organization_id: 'tenant-a', rule_id: 'drop.audit.v1', rule_version: 'v4', created_at: '2026-10-20T11:00:00Z' }
    sourceAnalyzeReceipts = [oldest, newest]
    sourceAnalyzeReceiptBlocks.set(oldest.key, 0)
    sourceAnalyzeReceiptBlocks.set(newest.key, 3)
    globalThis.fetch = (async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { receipts: Array<Record<string, unknown>> }
        return new Response(JSON.stringify({ ok: true, accepted: body.receipts.length }), { status: 200 })
    }) as typeof fetch
    const vacuumed: string[] = []

    expect(await migrateReceiptKind('https://logs.hanasand.com', 's'.repeat(40), 'analyze', table => vacuumed.push(table), 16_384, 16_384)).toBe(2)

    const selections = statements.filter(statement => statement.sql.startsWith('SELECT key,organization_id,rule_id,rule_version,created_at::text AS created_at FROM log_analyze_receipts')
        && statement.sql.includes('FROM log_analyze_receipts') && statement.sql.includes('ctid >='))
    expect(selections.map(statement => statement.params)).toEqual([[2, 4, 20_000], [2, 4, 20_000], [0, 2, 20_000], [0, 2, 20_000]])
    expect(selections.every(statement => !statement.sql.includes('ORDER BY ctid'))).toBe(true)
    expect(vacuumed).toEqual(['log_analyze_receipts', 'log_analyze_receipts'])
    expect(sourceAnalyzeReceipts).toHaveLength(0)
})

test('keeps source receipt rows when Logs does not acknowledge the full batch', async () => {
    sourceModelReceipts = [{ nonce: 'nonce-a', source_event_id: 'event-a', organization_id: 'tenant-a',
        original: Buffer.from('model proof bytes'), original_encoding: 'deflate-json-v1', created_at: '2026-10-20T10:00:00Z' }]
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 0 }), { status: 200 })) as typeof fetch
    await expect(migrateReceiptKind('https://logs.hanasand.com', 's'.repeat(40), 'model_probe')).rejects.toThrow('source receipts remain in Hanasand')
    expect(sourceModelReceipts).toHaveLength(1)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_model_probe_receipts'))).toBe(false)
})

test('retains analysis receipts if Logs does not acknowledge the exact batch', async () => {
    sourceAnalyzeReceipts = [{ key: 'a'.repeat(64), organization_id: 'tenant-a', rule_id: 'drop.audit.v1',
        rule_version: 'v3', created_at: '2026-10-20T12:00:00Z' }]
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 0 }), { status: 200 })) as typeof fetch
    await expect(migrateReceiptKind('https://logs.hanasand.com', 's'.repeat(40), 'analyze'))
        .rejects.toThrow('source receipts remain in Hanasand')
    expect(sourceAnalyzeReceipts).toHaveLength(1)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_analyze_receipts'))).toBe(false)
})

test('reclaims migrated receipts without wiping shared finding hit counts', async () => {
    const cleared = await clearMigratedLogReceipts()

    expect(cleared).toEqual(['log_analyze_receipts', 'log_model_probe_receipts', 'log_readiness_audit_receipts', 'log_proxy_receipts'])
    expect(statements.some(statement => statement.sql.includes('LOCK TABLE findings, log_analyze_receipts, log_model_probe_receipts'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE public.log_analyze_receipts'))).toBe(true)
    expect(statements.some(statement => statement.sql === 'DELETE FROM rule_hit_count_deltas WHERE source=\'receipts\'')).toBe(true)
    expect(statements.some(statement => statement.sql === 'DELETE FROM rule_hit_counts WHERE source=\'receipts\'')).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE public.rule_hit_'))).toBe(false)
})

test('does not reclaim receipt storage while any source migration receipt remains', async () => {
    sourceAnalyzeReceiptsRemain = true

    await expect(clearMigratedLogReceipts()).rejects.toThrow('source migration receipts remain')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
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
    const accessCount = { organization_id: 'tenant-a', ip: '192.0.2.1', day: '2026-10-20', amount: '7' }
    sourceThroughputSamples = [sample]
    sourceTuningSnapshots = [snapshot]
    sourceAccessCounts = [accessCount]
    const sent: Array<{ kind: string, rows: Array<Record<string, unknown>> }> = []
    globalThis.fetch = (async (input, init) => {
        expect(String(input)).toBe('https://logs.hanasand.com/api/migration/state')
        sent.push(JSON.parse(String(init?.body)) as { kind: string, rows: Array<Record<string, unknown>> })
        return new Response(JSON.stringify({ ok: true, accepted: sent.at(-1)?.rows.length }), { status: 200 })
    }) as typeof fetch

    expect(await migrateLogRuntimeState('https://logs.hanasand.com', 's'.repeat(40)))
        .toEqual({ throughputSamples: 1, tuningSnapshots: 1, additionalState: { log_access_counts: 1 } })
    expect(sent).toEqual([{ kind: 'throughput_samples', rows: [sample] }, { kind: 'tuning_snapshots', rows: [snapshot] },
        { kind: 'log_access_counts', rows: [accessCount] }])
    expect(sourceThroughputSamples).toHaveLength(0)
    expect(sourceTuningSnapshots).toHaveLength(0)
    expect(sourceAccessCounts).toHaveLength(0)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_throughput_samples'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_tuning_snapshots'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM log_access_counts'))).toBe(true)
})

test('rolls back each verified runtime-state delete when a source row changed after transfer', async () => {
    const linkage = { organization_id: 'tenant-a', event_id: 'a'.repeat(64), rule_id: 'ssh.audit.v1',
        event_timestamp: '2026-10-20T10:00:00Z', host: 'inspur', process_pid: null, parent_pid: null,
        executable: null, caller_executable: null, user_id: null, login_id: null, audit_id: null,
        archived_at: '2026-10-20T10:01:00Z' }
    const sample = { sampled_at: '2026-10-20T10:00:00.123456Z', checked_count: '42', pps: 1.2, eps: 1.4,
        historical_eps: 0.2, npps: 1.1, remaining: '3' }
    const linkageTwo = { ...linkage, event_id: 'b'.repeat(64) }
    const sampleTwo = { ...sample, sampled_at: '2026-10-20T10:01:00.123456Z' }
    const snapshot = { organization_id: 'tenant-a', logs: [{ key: 'ingest', value: 3 }], generated_at: null,
        refresh_requested_at: '2026-10-20T10:00:00.123456Z' }
    const snapshotTwo = { ...snapshot, organization_id: 'tenant-b' }
    globalThis.fetch = (async (_input, init) => {
        const payload = JSON.parse(String(init?.body)) as { rows?: unknown[], receipts?: unknown[] }
        return new Response(JSON.stringify({ ok: true, accepted: payload.rows?.length ?? payload.receipts?.length ?? 0 }), { status: 200 })
    }) as typeof fetch

    sourceArchiveRows = [linkage, linkageTwo]
    sourceDeleteMismatchTable = 'log_analyze_event_linkage_archive'
    await expect(migrateLinkageArchive('https://logs.hanasand.com', 's'.repeat(40))).rejects.toThrow('delete transaction was rolled back')
    expect(transactionErrors).toBe(1)
    expect(sourceArchiveRows).toEqual([linkage, linkageTwo])

    transactionErrors = 0
    sourceDeleteMismatchTable = 'log_throughput_samples'
    sourceThroughputSamples = [sample, sampleTwo]
    await expect(migrateLogRuntimeState('https://logs.hanasand.com', 's'.repeat(40))).rejects.toThrow('delete transaction was rolled back')
    expect(transactionErrors).toBe(1)
    expect(sourceThroughputSamples).toEqual([sample, sampleTwo])

    transactionErrors = 0
    sourceDeleteMismatchTable = 'log_tuning_snapshots'
    sourceThroughputSamples = []
    sourceTuningSnapshots = [snapshot, snapshotTwo]
    await expect(migrateLogRuntimeState('https://logs.hanasand.com', 's'.repeat(40))).rejects.toThrow('delete transaction was rolled back')
    expect(transactionErrors).toBe(1)
    expect(sourceTuningSnapshots).toEqual([snapshot, snapshotTwo])
})

test('migrates ingestion canonicals before copies and deletes canonicals after their dependents', async () => {
    sourceIngestionCanonical = [{ key: 'canonical-a', organization_id: 'tenant-a', source_event_id: 'source-event-a',
        canonical_event_id: 'target-event-a', original: { message: 'canonical' }, created_at: '2026-10-20T10:00:00Z' }]
    sourceIngestionCopies = [{ key: 'copy-a', canonical_key: 'canonical-a', envelope: { event: 'copy' }, created_at: '2026-10-20T10:01:00Z' }]
    const sent: Array<{ kind: string, rows: Array<Record<string, unknown>> }> = []
    globalThis.fetch = (async (_input, init) => {
        sent.push(JSON.parse(String(init?.body)) as { kind: string, rows: Array<Record<string, unknown>> })
        return new Response(JSON.stringify({ ok: true, accepted: sent.at(-1)?.rows.length }), { status: 200 })
    }) as typeof fetch

    const result = await migrateLogRuntimeState('https://logs.hanasand.com', 's'.repeat(40))
    const canonicalDelete = statements.findIndex(statement => statement.sql.startsWith('DELETE FROM log_ingestion_canonical'))
    const copiesDelete = statements.findIndex(statement => statement.sql.startsWith('DELETE FROM log_ingestion_copies'))

    expect(result.additionalState).toEqual({ log_ingestion_canonical: 1, log_ingestion_copies: 1 })
    expect(sent.map(batch => batch.kind)).toEqual(['log_ingestion_canonical', 'log_ingestion_copies', 'log_ingestion_canonical'])
    expect(copiesDelete).toBeGreaterThan(-1)
    expect(canonicalDelete).toBeGreaterThan(copiesDelete)
    expect(sourceIngestionCanonical).toHaveLength(0)
    expect(sourceIngestionCopies).toHaveLength(0)
})

test('transfers all supported analyzer counters and rolling state before deleting source rows', async () => {
    sourceRuntimeState = {
        log_mongo_ping_counts: [{ organization_id: 'tenant-a', host: 'db-1', service: 'cashflow', client_ip: '192.0.2.3',
            database_name: 'app', day: '2026-10-20', amount: '2', last_seen: '2026-10-20T10:00:00Z' }],
        log_proxy_counts: [{ organization_id: 'tenant-a', day: '2026-10-20', amount: '3' }],
        log_postgres_session_state: [{ organization_id: 'tenant-a', recent: [], dropped_records: '4', retained_sessions: '1' }],
        log_access_windows: [{ organization_id: 'tenant-a', ip: '192.0.2.4', recent: [1.5], alerted_at: null }],
        log_access_rule_windows: [{ organization_id: 'tenant-a', rule_id: 'access.v1', ip: '192.0.2.5', recent: [2.5], alerted_at: null }],
        log_ingest_access_ip_minutes: [{ organization_id: 'tenant-a', bucket: '2026-10-20T10:00:00Z', ip: '192.0.2.6', hits: '5' }],
        log_ingest_access_minute_batches: [{ batch_id: '8c27aade-5207-4c3b-98a3-1390528b4c69', organization_id: 'tenant-a',
            bucket: '2026-10-20T10:00:00Z', ip: '192.0.2.7', hits: '6' }],
        log_ingest_access_state: [{ organization_id: 'tenant-a', bucket: '2026-10-20T10:00:00Z', hits: '7', alerted: false }],
        log_routine_group_state: [{ organization_id: 'tenant-a', rule_id: 'routine.v1', scope: '192.0.2.8', recent: [] }],
    }
    const sent: Array<{ kind: string, rows: Array<Record<string, unknown>> }> = []
    globalThis.fetch = (async (_input, init) => {
        sent.push(JSON.parse(String(init?.body)) as { kind: string, rows: Array<Record<string, unknown>> })
        return new Response(JSON.stringify({ ok: true, accepted: sent.at(-1)?.rows.length }), { status: 200 })
    }) as typeof fetch

    const result = await migrateLogRuntimeState('https://logs.hanasand.com', 's'.repeat(40))

    expect(result.additionalState).toEqual({
        log_mongo_ping_counts: 1, log_proxy_counts: 1, log_postgres_session_state: 1,
        log_access_windows: 1, log_access_rule_windows: 1, log_ingest_access_ip_minutes: 1,
        log_ingest_access_minute_batches: 1, log_ingest_access_state: 1, log_routine_group_state: 1,
    })
    expect(sent.map(batch => batch.kind)).toEqual([
        'log_mongo_ping_counts', 'log_proxy_counts', 'log_postgres_session_state', 'log_access_windows',
        'log_access_rule_windows', 'log_ingest_access_ip_minutes', 'log_ingest_access_minute_batches',
        'log_ingest_access_state', 'log_routine_group_state',
    ])
    expect(Object.values(sourceRuntimeState).every(rows => rows.length === 0)).toBe(true)
})

test('clears only log-owned state after the source log event set is empty and rebuilds shared hit counts', async () => {
    const cleared = await clearMovedLogState()
    expect(cleared).toEqual(['log_analyze_receipts', 'log_dimensions', 'events', 'findings'])
    const catalogQuery = statements.find(statement => statement.sql.includes('FROM pg_class c JOIN pg_namespace n'))
    expect(catalogQuery?.sql).toContain('left(c.relname,4)=\'log_\'')
    expect(catalogQuery?.sql).not.toContain('NOT (c.relname=ANY($1::text[]))')
    const stateLocksAt = statements.findIndex(statement => statement.sql.includes('IN ACCESS EXCLUSIVE MODE NOWAIT') && statement.sql.includes('log_dimensions'))
    const firstStateCheckAt = statements.findIndex(statement => statement.sql === 'SELECT EXISTS(SELECT 1 FROM public.log_access_counts) AS present')
    expect(stateLocksAt).toBeGreaterThan(-1)
    expect(stateLocksAt).toBeLessThan(firstStateCheckAt)
    expect(statements.some(statement => statement.sql === 'TRUNCATE TABLE rule_hit_count_deltas RESTART IDENTITY')).toBe(true)
    expect(statements.some(statement => statement.sql.includes('SELECT organization_id,\'findings\',rule_id,count(*) FROM findings'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('INSERT INTO rule_hit_count_deltas'))).toBe(false)
})

test('refuses cleanup when Hanasand has an unrecognized log-prefixed relation', async () => {
    discoveredLogTables = ['log_untracked_future_table']

    await expect(clearMovedLogState()).rejects.toThrow('Unknown Hanasand Logs relation(s)')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('refuses final cleanup while the transfer outbox still contains rows', async () => {
    discoveredLogTables = ['log_analyze_receipts', 'log_delivery_outbox', 'log_dimensions']
    sourceLogOutboxRemain = true

    await expect(clearMovedLogState()).rejects.toThrow('transfer outbox still has rows')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('reclaims acknowledged organization snapshots from the migration outbox', async () => {
    discoveredLogTables = ['log_organization_sync_outbox', 'log_dimensions']

    const cleared = await clearMovedLogState()

    expect(cleared).toContain('log_organization_sync_outbox')
    expect(statements.some(statement => statement.sql.includes('log_organization_sync_outbox WHERE delivered_at IS NULL'))).toBe(true)
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE') && statement.sql.includes('public.log_organization_sync_outbox'))).toBe(true)
})

test('preserves unrelated events and findings while clearing empty Logs tables', async () => {
    sourceOtherEventsRemain = true
    sourceFindingsRemain = true

    const cleared = await clearMovedLogState()

    expect(cleared).toEqual(['log_analyze_receipts', 'log_dimensions'])
    const truncate = statements.find(statement => statement.sql.startsWith('TRUNCATE TABLE public.'))?.sql
    expect(truncate).not.toContain('public.events')
    expect(truncate).not.toContain('public.findings')
})

test('refuses to clear log-owned state while any Hanasand Logs event remains', async () => {
    sourceLogsRemain = true
    await expect(clearMovedLogState()).rejects.toThrow('while source log events remain')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('refuses to truncate Logs tables while migrated runtime state remains in Hanasand', async () => {
    sourceAccessCounts = [{ organization_id: 'tenant-a', ip: '192.0.2.1', day: '2026-10-20', amount: '7' }]

    await expect(clearMovedLogState()).rejects.toThrow('log_access_counts rows remain')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('refuses to clear log-owned state while any analysis receipt remains', async () => {
    sourceAnalyzeReceiptsRemain = true
    await expect(clearMovedLogState()).rejects.toThrow('while migration receipts remain')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('refuses to clear log-owned state while any specialized migration receipt remains', async () => {
    sourceSpecializedReceiptsRemain = true
    await expect(clearMovedLogState()).rejects.toThrow('while migration receipts remain')
    expect(statements.some(statement => statement.sql.startsWith('TRUNCATE TABLE'))).toBe(false)
})

test('retains source rows when Logs is busy and asks the caller to retry', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'busy' }), { status: 503 })) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40))

    expect(result).toEqual({ moved: 0, remaining: true, retry: true })
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})

test('moves a durably stored pending row without waiting for the Logs worker', async () => {
    const payloadSha256 = migrationPayloadHash(logMigrationEvent(sourceRows[0]))
    let migrationStatusCalls = 0
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/api/ingest')) return new Response(JSON.stringify({ ok: true, accepted: 1 }), { status: 201 })
        migrationStatusCalls++
        return new Response(JSON.stringify({ ok: true, statuses: [{
            id: '6a9ac283dd880765ce8d983ac72fb5710b0b8fc61542ec86170f2f2aa89fb8df', status: 'pending', payloadSha256,
        }] }), { status: 200 })
    }) as typeof fetch

    const result = await moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40))

    expect(result).toEqual({ moved: 1, remaining: true, retry: false, cursor: 'source-row-1' })
    expect(migrationStatusCalls).toBe(1)
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(true)
})

test('retains source rows when the acknowledgement count is incomplete', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, accepted: 0 }), { status: 201 })) as typeof fetch

    await expect(moveOneBatch('https://logs.hanasand.com', 'i'.repeat(40)))
        .rejects.toThrow('did not acknowledge the full migration batch')
    expect(statements.some(statement => statement.sql.startsWith('DELETE FROM events'))).toBe(false)
})
