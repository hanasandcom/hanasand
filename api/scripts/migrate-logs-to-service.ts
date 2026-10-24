import { queryOnce, withTransaction } from '#db'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { statfs } from 'node:fs/promises'
import path from 'node:path'
import { logsServiceConfiguration, logsOutboxEnabled, logsOutboxRemoteOnly, logsServiceDirect } from '../src/utils/logs/logOutboxConfig.ts'
import { logMigrationEvent } from '../src/utils/logs/logMigrationEvent.ts'

const batchSize = Math.max(1, Math.min(200, Number(process.env.LOGS_MIGRATION_BATCH_SIZE) || 200))
const receiptBatchSize = 100
const analyzeReceiptBatchSize = 2000
const analyzeReceiptTailChunkBytes = 4 * 1024 ** 3
const eventTailChunkBytes = 4 * 1024 ** 3
const findingScanSize = 10_000
const apply = process.argv.includes('--apply')
const maxPayloadBytes = 450_000
const configuredMigrationFreeSpaceReserveBytes = Number(process.env.LOGS_MIGRATION_MIN_FREE_BYTES)
const migrationFreeSpaceReserveBytes = Number.isSafeInteger(configuredMigrationFreeSpaceReserveBytes) && configuredMigrationFreeSpaceReserveBytes > 0
    ? configuredMigrationFreeSpaceReserveBytes : 24 * 1024 ** 3
const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))
type MigrationBatchResult = { moved: number, remaining: boolean, retry: boolean, cursor?: string, tailCursor?: string, rangeComplete?: boolean }

export function estimatedPlanRows(plan: unknown): number | null {
    const value = Array.isArray(plan) ? plan[0] : plan
    if (!value || typeof value !== 'object') return null
    const root = (value as { Plan?: unknown }).Plan
    if (!root || typeof root !== 'object') return null
    const rows = Number((root as { 'Plan Rows'?: unknown })['Plan Rows'])
    return Number.isSafeInteger(rows) && rows >= 0 ? rows : null
}

export function migrationStoragePathsFromDockerInspect(containers: Array<{
    Name: string
    Config?: { Env?: string[] }
    Mounts?: Array<{ Destination: string; Source: string }>
}>, names: string[]) {
    const paths: string[] = []
    for (const name of names) {
        const container = containers.find(item => item.Name.replace(/^\//, '') === name)
        if (!container) throw new Error('Logs migration paused: a PostgreSQL container could not be inspected; no batch was sent.')
        const pgData = container.Config?.Env?.find(value => value.startsWith('PGDATA='))?.slice('PGDATA='.length)
            || '/var/lib/postgresql/data'
        const mounts = container.Mounts || []
        const dataMount = mounts.filter(mount => pgData === mount.Destination || pgData.startsWith(`${mount.Destination.replace(/\/$/, '')}/`))
            .sort((left, right) => right.Destination.length - left.Destination.length)[0]
        if (!dataMount?.Source || !path.isAbsolute(dataMount.Source)) {
            throw new Error('Logs migration paused: PostgreSQL data volume is not mounted at a verifiable host path; no batch was sent.')
        }
        paths.push(dataMount.Source)
        const walMount = mounts.find(mount => mount.Destination === `${pgData.replace(/\/$/, '')}/pg_wal`)
        if (walMount?.Source && path.isAbsolute(walMount.Source)) paths.push(walMount.Source)
    }
    return [...new Set(paths)]
}

let migrationStoragePathsCache: Promise<string[]> | null = null

export function resolveMigrationStoragePaths(
    override: string | undefined,
    names: string[],
    inspectContainers: (names: string[]) => Array<{
        Name: string
        Config?: { Env?: string[] }
        Mounts?: Array<{ Destination: string; Source: string }>
    }>,
) {
    if (override) {
        const paths = override.split(',').map(value => value.trim()).filter(Boolean)
        if (!paths.length || paths.some(value => !path.isAbsolute(value))) {
            throw new Error('Logs migration paused: LOGS_MIGRATION_STORAGE_PATH must list absolute PostgreSQL storage paths; no batch was sent.')
        }
        return paths
    }
    try {
        return migrationStoragePathsFromDockerInspect(inspectContainers(names), names)
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Logs migration paused:')) throw error
        throw new Error('Logs migration paused: Docker could not verify the Hanasand and Logs database volumes; no batch was sent.', { cause: error })
    }
}

async function migrationStoragePaths() {
    if (migrationStoragePathsCache) return migrationStoragePathsCache
    migrationStoragePathsCache = (async () => {
        const names = [process.env.LOGS_MIGRATION_HANASAND_DB_CONTAINER || 'hanasand_database',
            process.env.LOGS_MIGRATION_LOGS_DB_CONTAINER || 'logs_database']
        return resolveMigrationStoragePaths(process.env.LOGS_MIGRATION_STORAGE_PATH, names, containerNames =>
            JSON.parse(execFileSync('docker', ['inspect', ...containerNames], { encoding: 'utf8', timeout: 5000 })))
    })()
    return migrationStoragePathsCache
}

export async function assertMigrationStorageReserve(getAvailableBytes = async (storagePath: string) => {
    const filesystem = await statfs(storagePath)
    return filesystem.bavail * filesystem.bsize
}, minimumBytes = migrationFreeSpaceReserveBytes, storagePaths?: string[]) {
    const checkedPaths = storagePaths || await migrationStoragePaths()
    if (!checkedPaths.length) throw new Error('Logs migration paused: no PostgreSQL storage paths were verified; no batch was sent.')
    for (const storagePath of checkedPaths) {
        const availableBytes = await getAvailableBytes(storagePath)
        if (!Number.isSafeInteger(availableBytes) || availableBytes < minimumBytes) {
            throw new Error(`Logs migration paused: a PostgreSQL data/WAL filesystem is below the ${Math.ceil(minimumBytes / 1024 ** 3)} GiB reserve; no new batch was sent.`)
        }
    }
    return checkedPaths
}

function permanentError(message: string) {
    return Object.assign(new Error(message), { migrationPermanent: true })
}

// Keep this canonicalizer aligned with Logs' ingest sourcePayloadHash contract.
function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
    if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>
        return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`
    }
    return JSON.stringify(value) ?? 'null'
}

export function migrationPayloadHash(event: ReturnType<typeof logMigrationEvent>) {
    return createHash('sha256').update(stableJson(event)).digest('hex')
}

export function migrationTailPageRange(relationBytes: number, blockSize: number, upperExclusiveBlock?: number,
    chunkBytes = analyzeReceiptTailChunkBytes) {
    if (!Number.isSafeInteger(relationBytes) || relationBytes < 0 || !Number.isSafeInteger(blockSize) || blockSize <= 0
        || !Number.isSafeInteger(chunkBytes) || chunkBytes <= 0
        || (upperExclusiveBlock !== undefined && (!Number.isSafeInteger(upperExclusiveBlock) || upperExclusiveBlock < 0))) {
        throw new Error('Invalid PostgreSQL tail-range geometry.')
    }
    const pageCount = Math.ceil(relationBytes / blockSize)
    const upper = upperExclusiveBlock === undefined ? pageCount : Math.min(upperExclusiveBlock, pageCount)
    if (!upper) return null
    const pagesPerChunk = Math.max(1, Math.floor(chunkBytes / blockSize))
    return { lowerBlock: Math.max(0, upper - pagesPerChunk), upperBlock: upper }
}

export function migrationTailVacuumArgs(containerName: string, databaseUser: string, databaseName: string,
    table: 'events' | 'log_analyze_receipts') {
    if (!containerName || !databaseUser || !databaseName) throw new Error('Migration vacuum requires the inspected PostgreSQL container, user and database.')
    return ['exec', containerName, 'psql', '-X', '-w', '-v', 'ON_ERROR_STOP=1', '-U', databaseUser, '-d', databaseName,
        '-c', 'SET lock_timeout = \'1s\'', '-c', 'SET statement_timeout = \'20min\'', '-c', `VACUUM (TRUNCATE) public.${table}`]
}

export function runMigrationTailVacuum(table: 'events' | 'log_analyze_receipts') {
    const containerName = process.env.LOGS_MIGRATION_HANASAND_DB_CONTAINER || 'hanasand_database'
    const inspected = JSON.parse(execFileSync('docker', ['inspect', containerName], { encoding: 'utf8', timeout: 5000 })) as Array<{
        Config?: { Env?: string[] }
    }>
    const environment = new Map((inspected[0]?.Config?.Env || []).flatMap(value => {
        const separator = value.indexOf('=')
        return separator > 0 ? [[value.slice(0, separator), value.slice(separator + 1)] as const] : []
    }))
    const databaseUser = environment.get('POSTGRES_USER')
    const databaseName = environment.get('POSTGRES_DB')
    if (!databaseUser || !databaseName) throw new Error('Migration vacuum paused: PostgreSQL identity could not be inspected.')
    execFileSync('docker', migrationTailVacuumArgs(containerName, databaseUser, databaseName, table), {
        encoding: 'utf8', timeout: 25 * 60_000, maxBuffer: 1024 * 1024,
    })
}

const knownLogStateRelations = [
    'log_access_counts', 'log_access_rule_windows', 'log_access_windows', 'log_analyze_event_linkage_archive',
    'log_analyze_receipts', 'log_catchup_progress', 'log_counts', 'log_counts_state', 'log_delivery_outbox',
    'log_dimensions', 'log_dimensions_state', 'log_ingest_access_ip_minutes', 'log_ingest_access_minute_batches',
    'log_ingest_access_state', 'log_ingestion_canonical', 'log_ingestion_copies', 'log_model_probe_receipts',
    'log_mongo_ping_counts', 'log_organization_sync_cursor', 'log_organization_sync_outbox',
    'log_postgres_session_state', 'log_processing_cursors', 'log_proxy_counts', 'log_proxy_receipts',
    'log_readiness_audit_receipts', 'log_routine_group_state', 'log_throughput_samples', 'log_tuning_snapshots',
]

export async function clearMigratedLogReceipts(transaction = withTransaction) {
    return transaction(async query => {
        await query('SET LOCAL lock_timeout = \'2s\'')
        await query('SET LOCAL statement_timeout = \'5min\'')
        await query('LOCK TABLE findings, log_analyze_receipts, log_model_probe_receipts, log_readiness_audit_receipts, log_proxy_receipts, rule_hit_counts, rule_hit_count_deltas IN SHARE ROW EXCLUSIVE MODE')
        const remaining = await query(`SELECT EXISTS(SELECT 1 FROM log_analyze_receipts)
            OR EXISTS(SELECT 1 FROM log_model_probe_receipts)
            OR EXISTS(SELECT 1 FROM log_readiness_audit_receipts)
            OR EXISTS(SELECT 1 FROM log_proxy_receipts) AS present`)
        if (remaining.rows[0]?.present) {
            throw new Error('Cannot reclaim receipt storage while source migration receipts remain.')
        }
        const cleared = ['log_analyze_receipts', 'log_model_probe_receipts', 'log_readiness_audit_receipts', 'log_proxy_receipts']
        await query(`TRUNCATE TABLE ${cleared.map(name => `public.${name}`).join(', ')} RESTART IDENTITY`)
        // These projections also serve findings. Keep pending finding deltas and
        // finding totals intact; only receipt-derived counts leave with Logs.
        await query('DELETE FROM rule_hit_count_deltas WHERE source=\'receipts\'')
        await query('DELETE FROM rule_hit_counts WHERE source=\'receipts\'')
        return cleared
    })
}

export async function clearMovedLogState(transaction = withTransaction) {
    return transaction(async query => {
        await query('SET LOCAL lock_timeout = \'2s\'')
        await query('SET LOCAL statement_timeout = \'5min\'')
        await query('LOCK TABLE events, findings, rule_hit_counts, rule_hit_count_deltas, log_analyze_receipts, log_model_probe_receipts, log_readiness_audit_receipts, log_proxy_receipts IN SHARE ROW EXCLUSIVE MODE')
        const tables = await query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relkind='r' AND left(c.relname,4)='log_'
            ORDER BY c.relname`)
        const discovered = tables.rows.map(row => String(row.relname))
        const known = new Set(knownLogStateRelations)
        const unexpected = discovered.filter(name => !known.has(name))
        if (unexpected.length) throw new Error(`Unknown Hanasand Logs relation(s); cleanup stopped: ${unexpected.join(', ')}`)
        const cleared = knownLogStateRelations.filter(name => discovered.includes(name))
        if (cleared.length) {
            // Hold an exclusive lock from the emptiness checks through TRUNCATE.
            // NOWAIT makes active readers/writers defer cleanup rather than wait
            // while this transaction owns locks on the shared Hanasand tables.
            await query(`LOCK TABLE ${cleared.map(name => `public.${name}`).join(', ')} IN ACCESS EXCLUSIVE MODE NOWAIT`)
        }
        const pendingOutboxes = ['log_delivery_outbox', 'log_organization_sync_outbox'].filter(name => discovered.includes(name))
        if (pendingOutboxes.length) {
            const checks = pendingOutboxes.map(name => name === 'log_organization_sync_outbox'
                ? 'EXISTS(SELECT 1 FROM public.log_organization_sync_outbox WHERE delivered_at IS NULL OR lease_until IS NOT NULL)'
                : 'EXISTS(SELECT 1 FROM public.log_delivery_outbox)')
            const pending = await query(`SELECT ${checks.join(' OR ')} AS present`)
            if (pending.rows[0]?.present) {
                throw new Error('Cannot clear Hanasand Logs state while a transfer outbox still has rows.')
            }
        }
        const remaining = await query('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id=\'logs\') AS present')
        if (remaining.rows[0]?.present) {
            throw new Error('Cannot clear Hanasand Logs state while source log events remain.')
        }
        const receiptsRemaining = await query(`SELECT EXISTS(SELECT 1 FROM log_analyze_receipts)
            OR EXISTS(SELECT 1 FROM log_model_probe_receipts)
            OR EXISTS(SELECT 1 FROM log_readiness_audit_receipts)
            OR EXISTS(SELECT 1 FROM log_proxy_receipts) AS present`)
        if (receiptsRemaining.rows[0]?.present) {
            throw new Error('Cannot clear Hanasand Logs state while migration receipts remain.')
        }
        for (const relation of runtimeStateRelations) {
            const exists = await query('SELECT to_regclass($1) AS relation', [`public.${relation}`])
            if (!exists.rows[0]?.relation) continue
            const state = await query(`SELECT EXISTS(SELECT 1 FROM public.${relation}) AS present`)
            if (state.rows[0]?.present) {
                throw new Error(`Cannot clear Hanasand Logs state while ${relation} rows remain.`)
            }
        }
        const eventsRemain = await query('SELECT EXISTS(SELECT 1 FROM events) AS present')
        const findingsRemain = await query('SELECT EXISTS(SELECT 1 FROM findings) AS present')
        const truncate = [...cleared]
        if (!eventsRemain.rows[0]?.present) truncate.push('events')
        if (!findingsRemain.rows[0]?.present) truncate.push('findings')
        if (truncate.length) {
            const sharedRelations = truncate.filter(name => name === 'events' || name === 'findings')
            if (sharedRelations.length) {
                await query(`LOCK TABLE ${sharedRelations.map(name => `public.${name}`).join(', ')} IN ACCESS EXCLUSIVE MODE NOWAIT`)
            }
            const relations = truncate.map(name => `public.${name}`)
            await query(`TRUNCATE TABLE ${relations.join(', ')}`)
            cleared.push(...truncate.filter(name => name === 'events' || name === 'findings'))
        }
        await query('LOCK TABLE rule_hit_counts, rule_hit_count_deltas IN ACCESS EXCLUSIVE MODE NOWAIT')
        await query('TRUNCATE TABLE rule_hit_counts')
        await query('TRUNCATE TABLE rule_hit_count_deltas RESTART IDENTITY')
        await query(`INSERT INTO rule_hit_counts(organization_id,source,rule_id,hits)
            SELECT organization_id,'findings',rule_id,count(*) FROM findings GROUP BY organization_id,rule_id`)
        return cleared
    })
}

export async function migrateFindings(url: string, syncToken: string, sourceEventIds: string[]) {
    const findings = await withTransaction(async query => {
        const result = await query(`SELECT id,organization_id,finding_key,rule_id,severity,status,summary,evidence,event_ids,
                first_observed::text AS first_observed,last_observed::text AS last_observed,assignee_id,analyst_note,
                case_id,case_delivery_attempted_at::text AS case_delivery_attempted_at,
                created_at::text AS created_at,updated_at::text AS updated_at
            FROM findings WHERE event_ids && $1::text[] ORDER BY finding_key`, [sourceEventIds])
        return result.rows
    })
    if (!findings.length) return 0

    const referencedIds = [...new Set(findings.flatMap(finding => Array.isArray(finding.event_ids) ? finding.event_ids.map(String) : []))]
    const eventRows = await withTransaction(query => query(`SELECT id,ingestion_id,organization_id,event_timestamp::text AS event_timestamp,normalized
        FROM events WHERE id=ANY($1::text[])`, [referencedIds]))
    const byId = new Map(eventRows.rows.map(row => [String(row.id), row]))
    if (referencedIds.some(id => !byId.has(id) || byId.get(id)?.ingestion_id !== 'logs')) {
        throw permanentError('A finding references missing or non-Logs evidence; its source events and finding remain in Hanasand for review.')
    }
    const targetIdBySourceId = new Map<string, string>()
    for (const [id, row] of byId) {
        const event = logMigrationEvent(row)
        targetIdBySourceId.set(id, createHash('sha256').update(`service:${event.sourceEventId}`).digest('hex'))
    }
    const migrated = findings.map(finding => {
        const event_ids = (finding.event_ids as string[]).map(id => targetIdBySourceId.get(String(id))!)
        return { ...finding, event_ids, finding_key: `${finding.organization_id}:${finding.rule_id}:${event_ids.slice().sort().join(',')}` }
    })

    let offset = 0
    while (offset < migrated.length) {
        const batch: typeof migrated = []
        while (offset + batch.length < migrated.length && batch.length < 200) {
            const candidate = [...batch, migrated[offset + batch.length]]
            if (Buffer.byteLength(JSON.stringify({ findings: candidate })) > maxPayloadBytes) break
            batch.push(migrated[offset + batch.length])
        }
        if (!batch.length) throw permanentError('A source finding exceeds the Logs migration payload limit; its source data remains in Hanasand.')
        await assertMigrationStorageReserve()
        const response = await fetch(`${url}/api/migration/findings`, {
            method: 'POST',
            headers: { authorization: `Bearer ${syncToken}`, 'content-type': 'application/json' },
            body: JSON.stringify({ findings: batch }),
            signal: AbortSignal.timeout(10_000),
        })
        const body = await response.json().catch(() => ({})) as { ok?: boolean, accepted?: number, error?: string }
        if (response.status === 429 || response.status === 503) throw Object.assign(new Error('Logs finding migration is busy; source findings remain in Hanasand.'), { code: 'DB_QUEUE_FULL' })
        if (!response.ok || body.ok !== true || body.accepted !== batch.length) {
            throw permanentError(`Logs did not acknowledge the full finding batch (HTTP ${response.status}${body.error ? `: ${body.error}` : ''}); source findings remain in Hanasand.`)
        }
        offset += batch.length
    }

    const deleteRows = findings.map(finding => ({ id: finding.id, finding_key: finding.finding_key, updated_at: finding.updated_at }))
    await withTransaction(async query => {
        await query('SET LOCAL lock_timeout = \'1s\'')
        await query('SET LOCAL statement_timeout = \'20s\'')
        const deleted = await query(`DELETE FROM findings AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                id text,finding_key text,updated_at timestamptz)
            WHERE source.id=expected.id AND source.finding_key=expected.finding_key AND source.updated_at=expected.updated_at
            RETURNING source.id`, [JSON.stringify(deleteRows)])
        if (deleted.rows.length !== findings.length) throw new Error('A source finding changed during migration; its delete transaction was rolled back.')
    })
    return findings.length
}

export async function migrateFindingsBeforeEvents(url: string, syncToken: string) {
    let cursor = ''
    let migrated = 0
    while (true) {
        const source = await withTransaction(query => query(`SELECT id FROM events
            WHERE ingestion_id='logs' AND id > $1 ORDER BY id LIMIT $2`, [cursor, findingScanSize]))
        const ids = source.rows.map(row => String(row.id))
        if (!ids.length) return migrated
        migrated += await migrateFindings(url, syncToken, ids)
        cursor = ids[ids.length - 1]!
    }
}

export async function migrateReceiptKind(url: string, syncToken: string, kind: 'model_probe' | 'readiness_audit' | 'proxy' | 'analyze',
    vacuumTail: (table: 'log_analyze_receipts') => void = runMigrationTailVacuum,
    tailChunkBytes = analyzeReceiptTailChunkBytes) {
    const modelProbe = kind === 'model_probe'
    const readinessAudit = kind === 'readiness_audit'
    const analyze = kind === 'analyze'
    const table = modelProbe ? 'log_model_probe_receipts' : readinessAudit ? 'log_readiness_audit_receipts' : analyze ? 'log_analyze_receipts' : 'log_proxy_receipts'
    const keyColumn = modelProbe ? 'nonce' : readinessAudit ? 'exec_id' : 'key'
    const batchLimit = analyze ? analyzeReceiptBatchSize : receiptBatchSize
    let cursor = ''
    let migrated = 0
    let analyzeUpperBlock: number | undefined
    let analyzeBlockSize = 8192
    let analyzeTailRange: { lowerBlock: number; upperBlock: number } | null = null
    let analyzeDone = false
    while (true) {
        const source = await withTransaction(async query => {
            const fields = modelProbe
                ? 'nonce,source_event_id,organization_id,original,original_encoding,created_at::text AS created_at'
                : readinessAudit ? 'exec_id,organization_id,root_source_event_id,chain_digest,original,original_encoding,created_at::text AS created_at'
                    : analyze ? 'key,organization_id,rule_id,rule_version,created_at::text AS created_at'
                        : 'key,organization_id,connection_id::text AS connection_id,canonical_event_id,original,created_at::text AS created_at'
            if (analyze) {
                await query('SET LOCAL statement_timeout = \'5min\'')
                analyzeTailRange = null
                analyzeDone = false
                if (analyzeUpperBlock === undefined) {
                    const geometry = await query(`SELECT pg_relation_size('public.log_analyze_receipts')::bigint AS bytes,
                        current_setting('block_size')::integer AS block_size`)
                    const bytes = Number(geometry.rows[0]?.bytes)
                    const blockSize = Number(geometry.rows[0]?.block_size)
                    analyzeBlockSize = blockSize
                    const range = migrationTailPageRange(bytes, blockSize, undefined, tailChunkBytes)
                    if (!range) {
                        analyzeDone = true
                        return { rows: [] }
                    }
                    analyzeUpperBlock = range.upperBlock
                }
                const currentUpperBlock = analyzeUpperBlock
                if (currentUpperBlock === undefined) throw new Error('Migration paused: receipt table tail geometry was not initialized.')
                const range = migrationTailPageRange(currentUpperBlock * analyzeBlockSize, analyzeBlockSize,
                    currentUpperBlock, tailChunkBytes)
                if (!range) {
                    const remaining = await query('SELECT EXISTS(SELECT 1 FROM log_analyze_receipts) AS present')
                    if (!remaining.rows[0]?.present) {
                        analyzeDone = true
                        return { rows: [] }
                    }
                    analyzeUpperBlock = undefined
                    return { rows: [] }
                }
                analyzeTailRange = range
                const selected = await query(`SELECT ${fields} FROM log_analyze_receipts
                    WHERE ctid >= ('(' || $1::text || ',0)')::tid AND ctid < ('(' || $2::text || ',0)')::tid
                    ORDER BY ctid LIMIT $3`, [range.lowerBlock, range.upperBlock, batchLimit])
                return selected
            }
            await query('SET LOCAL statement_timeout = \'20s\'')
            return query(`SELECT ${fields} FROM ${table} WHERE ${keyColumn} > $1 ORDER BY ${keyColumn} LIMIT $2`, [cursor, batchLimit])
        })
        if (!source.rows.length) {
            if (!analyze) return migrated
            if (analyzeDone) return migrated
            const range = analyzeTailRange
            if (range) {
                vacuumTail('log_analyze_receipts')
                if (range.lowerBlock === 0) {
                    const remaining = await withTransaction(query => query('SELECT EXISTS(SELECT 1 FROM log_analyze_receipts) AS present'))
                    if (!remaining.rows[0]?.present) return migrated
                    analyzeUpperBlock = undefined
                } else {
                    analyzeUpperBlock = range.lowerBlock
                }
                continue
            }
            // Geometry may have changed during the previous vacuum. Refresh from
            // the physical tail and make one more pass for rows inserted late.
            continue
        }

        const batch: Array<Record<string, unknown>> = []
        for (const row of source.rows) {
            const { original, ...fields } = row
            const receipt = kind === 'proxy' || analyze ? row : { ...fields, original_base64: Buffer.from(original).toString('base64') }
            if (Buffer.byteLength(JSON.stringify({ kind, receipts: [...batch, receipt] })) > maxPayloadBytes) break
            batch.push(receipt)
        }
        if (!batch.length) throw permanentError(`The oldest ${kind} receipt exceeds the Logs migration payload limit; it remains in Hanasand.`)

        let acknowledged = false
        let retryDelay = 1000
        while (!acknowledged) {
            await assertMigrationStorageReserve()
            const response = await fetch(`${url}/api/migration/receipts`, {
                method: 'POST',
                headers: { authorization: `Bearer ${syncToken}`, 'content-type': 'application/json' },
                body: JSON.stringify({ kind, receipts: batch }),
                signal: AbortSignal.timeout(10_000),
            })
            const body = await response.json().catch(() => ({})) as { ok?: boolean, accepted?: number, error?: string }
            if (response.status === 429 || response.status === 503) {
                await sleep(retryDelay)
                retryDelay = Math.min(30_000, retryDelay * 2)
                continue
            }
            if (!response.ok || body.ok !== true || body.accepted !== batch.length) {
                throw permanentError(`Logs did not verify the full ${kind} receipt batch (HTTP ${response.status}${body.error ? `: ${body.error}` : ''}); source receipts remain in Hanasand.`)
            }
            acknowledged = true
        }

        const deletion = await withTransaction(async query => {
            await query('SET LOCAL lock_timeout = \'1s\'')
            await query('SET LOCAL statement_timeout = \'20s\'')
            if (modelProbe) {
                return query(`DELETE FROM log_model_probe_receipts AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    nonce text,source_event_id text,organization_id text,original_encoding text,created_at timestamptz,original_base64 text)
                    WHERE source.nonce=expected.nonce AND source.source_event_id=expected.source_event_id
                      AND source.organization_id=expected.organization_id AND source.original=decode(expected.original_base64,'base64')
                      AND source.original_encoding=expected.original_encoding AND source.created_at=expected.created_at
                    RETURNING source.nonce`, [JSON.stringify(batch)])
            }
            if (readinessAudit) return query(`DELETE FROM log_readiness_audit_receipts AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                exec_id text,organization_id text,root_source_event_id text,chain_digest text,original_encoding text,created_at timestamptz,original_base64 text)
                WHERE source.exec_id=expected.exec_id AND source.organization_id=expected.organization_id
                  AND source.root_source_event_id=expected.root_source_event_id AND source.chain_digest=expected.chain_digest
                  AND source.original=decode(expected.original_base64,'base64')
                  AND source.original_encoding=expected.original_encoding AND source.created_at=expected.created_at
                RETURNING source.exec_id`, [JSON.stringify(batch)])
            if (analyze) return query(`DELETE FROM log_analyze_receipts AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    key text,organization_id text,rule_id text,rule_version text,created_at timestamptz)
                WHERE source.key=expected.key AND source.organization_id=expected.organization_id
                  AND source.rule_id=expected.rule_id AND source.rule_version=expected.rule_version
                  AND source.created_at=expected.created_at
                RETURNING source.key`, [JSON.stringify(batch)])
            return query(`DELETE FROM log_proxy_receipts AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    key text,organization_id text,connection_id uuid,canonical_event_id text,original jsonb,created_at timestamptz)
                WHERE source.key=expected.key AND source.organization_id=expected.organization_id
                  AND source.connection_id=expected.connection_id AND source.canonical_event_id=expected.canonical_event_id
                  AND source.original=expected.original AND source.created_at=expected.created_at
                RETURNING source.key`, [JSON.stringify(batch)])
        })
        if (deletion.rows.length !== batch.length) throw new Error(`A ${kind} receipt changed during migration; its delete transaction was rolled back.`)
        migrated += batch.length
        if (!analyze) cursor = String(batch[batch.length - 1]![keyColumn])
    }
}

export async function migrateAnalysisReceipts(url: string, syncToken: string,
    vacuumTail: (table: 'log_analyze_receipts') => void = runMigrationTailVacuum,
    tailChunkBytes = analyzeReceiptTailChunkBytes) {
    const modelProbe = await migrateReceiptKind(url, syncToken, 'model_probe')
    const readinessAudit = await migrateReceiptKind(url, syncToken, 'readiness_audit')
    const proxy = await migrateReceiptKind(url, syncToken, 'proxy')
    const analyze = await migrateReceiptKind(url, syncToken, 'analyze', vacuumTail, tailChunkBytes)
    return { modelProbe, readinessAudit, proxy, analyze }
}

export async function migrateLinkageArchive(url: string, syncToken: string) {
    const exists = await withTransaction(query => query('SELECT to_regclass($1) AS relation', ['public.log_analyze_event_linkage_archive']))
    if (!exists.rows[0]?.relation) return 0
    let organizationCursor = ''
    let eventCursor = ''
    let migrated = 0
    while (true) {
        const selected = await withTransaction(async query => {
            await query('SET LOCAL statement_timeout = \'20s\'')
            return query(`SELECT organization_id,event_id,rule_id,event_timestamp::text AS event_timestamp,host,process_pid,parent_pid,
                    executable,caller_executable,user_id,login_id,audit_id,archived_at::text AS archived_at
                FROM log_analyze_event_linkage_archive
                WHERE (organization_id,event_id)>($1,$2) ORDER BY organization_id,event_id LIMIT 500`, [organizationCursor, eventCursor])
        })
        if (!selected.rows.length) return migrated
        const rows: Array<Record<string, unknown>> = []
        for (const row of selected.rows) {
            const candidate = [...rows, row]
            if (Buffer.byteLength(JSON.stringify({ rows: candidate })) > maxPayloadBytes) break
            rows.push(row)
        }
        if (!rows.length) throw permanentError('A linkage archive row exceeds the Logs migration payload limit; it remains in Hanasand.')

        let acknowledged = false
        let retryDelay = 1000
        while (!acknowledged) {
            await assertMigrationStorageReserve()
            const response = await fetch(`${url}/api/migration/linkage-archive`, {
                method: 'POST',
                headers: { authorization: `Bearer ${syncToken}`, 'content-type': 'application/json' },
                body: JSON.stringify({ rows }),
                signal: AbortSignal.timeout(10_000),
            })
            const body = await response.json().catch(() => ({})) as { ok?: boolean, accepted?: number, error?: string }
            if (response.status === 429 || response.status === 503) {
                await sleep(retryDelay)
                retryDelay = Math.min(30_000, retryDelay * 2)
                continue
            }
            if (!response.ok || body.ok !== true || body.accepted !== rows.length) {
                throw permanentError(`Logs did not verify the full linkage archive batch (HTTP ${response.status}${body.error ? `: ${body.error}` : ''}); source archive rows remain in Hanasand.`)
            }
            acknowledged = true
        }

        await withTransaction(async query => {
            await query('SET LOCAL lock_timeout = \'1s\'')
            await query('SET LOCAL statement_timeout = \'20s\'')
            const deleted = await query(`DELETE FROM log_analyze_event_linkage_archive AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    organization_id text,event_id text,rule_id text,event_timestamp timestamptz,host text,process_pid text,
                    parent_pid text,executable text,caller_executable text,user_id text,login_id text,audit_id text,archived_at timestamptz)
                WHERE source.organization_id=expected.organization_id AND source.event_id=expected.event_id AND source.rule_id=expected.rule_id
                  AND source.event_timestamp IS NOT DISTINCT FROM expected.event_timestamp AND source.host IS NOT DISTINCT FROM expected.host
                  AND source.process_pid IS NOT DISTINCT FROM expected.process_pid AND source.parent_pid IS NOT DISTINCT FROM expected.parent_pid
                  AND source.executable IS NOT DISTINCT FROM expected.executable AND source.caller_executable IS NOT DISTINCT FROM expected.caller_executable
                  AND source.user_id IS NOT DISTINCT FROM expected.user_id AND source.login_id IS NOT DISTINCT FROM expected.login_id
                  AND source.audit_id IS NOT DISTINCT FROM expected.audit_id AND source.archived_at=expected.archived_at
                RETURNING source.organization_id,source.event_id`, [JSON.stringify(rows)])
            if (deleted.rows.length !== rows.length) throw new Error('A linkage archive row changed during migration; its delete transaction was rolled back.')
        })
        const last = rows[rows.length - 1]!
        organizationCursor = String(last.organization_id)
        eventCursor = String(last.event_id)
        migrated += rows.length
    }
}

type MigrationStateKind = 'throughput_samples' | 'tuning_snapshots' | 'log_access_counts' | 'log_mongo_ping_counts'
    | 'log_proxy_counts' | 'log_postgres_session_state' | 'log_access_windows' | 'log_access_rule_windows'
    | 'log_ingest_access_ip_minutes' | 'log_ingest_access_minute_batches' | 'log_ingest_access_state'
    | 'log_routine_group_state' | 'log_ingestion_canonical' | 'log_ingestion_copies'

async function sendMigrationState(url: string, syncToken: string, kind: MigrationStateKind, rows: Array<Record<string, unknown>>) {
    let retryDelay = 1000
    while (true) {
        await assertMigrationStorageReserve()
        const response = await fetch(`${url}/api/migration/state`, {
            method: 'POST',
            headers: { authorization: `Bearer ${syncToken}`, 'content-type': 'application/json' },
            body: JSON.stringify({ kind, rows }),
            signal: AbortSignal.timeout(10_000),
        })
        const body = await response.json().catch(() => ({})) as { ok?: boolean, accepted?: number, error?: string }
        if (response.status === 429 || response.status === 503) {
            await sleep(retryDelay)
            retryDelay = Math.min(30_000, retryDelay * 2)
            continue
        }
        if (!response.ok || body.ok !== true || body.accepted !== rows.length) {
            throw permanentError(`Logs did not verify the full ${kind} batch (HTTP ${response.status}${body.error ? `: ${body.error}` : ''}); source rows remain in Hanasand.`)
        }
        return
    }
}

type RuntimeStateTransfer = {
    kind: Exclude<MigrationStateKind, 'throughput_samples' | 'tuning_snapshots'>
    table: string
    selectSql: string
    deleteSql: string
    cursorColumn?: string
}

const runtimeStateTransfers: RuntimeStateTransfer[] = [
    {
        kind: 'log_access_counts', table: 'log_access_counts',
        selectSql: `SELECT organization_id,ip::text AS ip,day::text AS day,amount::text AS amount
            FROM log_access_counts ORDER BY organization_id,ip,day LIMIT $1`,
        deleteSql: `DELETE FROM log_access_counts AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,ip inet,day date,amount bigint)
            WHERE source.organization_id=expected.organization_id AND source.ip=expected.ip AND source.day=expected.day
              AND source.amount=expected.amount RETURNING source.organization_id`,
    },
    {
        kind: 'log_mongo_ping_counts', table: 'log_mongo_ping_counts',
        selectSql: `SELECT organization_id,host,service,client_ip::text AS client_ip,database_name,day::text AS day,
                amount::text AS amount,last_seen::text AS last_seen
            FROM log_mongo_ping_counts ORDER BY organization_id,host,service,client_ip,database_name,day LIMIT $1`,
        deleteSql: `DELETE FROM log_mongo_ping_counts AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,host text,service text,client_ip inet,database_name text,day date,amount bigint,last_seen timestamptz)
            WHERE source.organization_id=expected.organization_id AND source.host=expected.host AND source.service=expected.service
              AND source.client_ip=expected.client_ip AND source.database_name=expected.database_name AND source.day=expected.day
              AND source.amount=expected.amount AND source.last_seen=expected.last_seen RETURNING source.organization_id`,
    },
    {
        kind: 'log_proxy_counts', table: 'log_proxy_counts',
        selectSql: `SELECT organization_id,day::text AS day,amount::text AS amount
            FROM log_proxy_counts ORDER BY organization_id,day LIMIT $1`,
        deleteSql: `DELETE FROM log_proxy_counts AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,day date,amount bigint)
            WHERE source.organization_id=expected.organization_id AND source.day=expected.day AND source.amount=expected.amount
            RETURNING source.organization_id`,
    },
    {
        kind: 'log_postgres_session_state', table: 'log_postgres_session_state',
        selectSql: `SELECT organization_id,recent,dropped_records::text AS dropped_records,retained_sessions::text AS retained_sessions
            FROM log_postgres_session_state ORDER BY organization_id LIMIT $1`,
        deleteSql: `DELETE FROM log_postgres_session_state AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,recent jsonb,dropped_records bigint,retained_sessions bigint)
            WHERE source.organization_id=expected.organization_id AND source.recent=expected.recent
              AND source.dropped_records=expected.dropped_records AND source.retained_sessions=expected.retained_sessions
            RETURNING source.organization_id`,
    },
    {
        kind: 'log_access_windows', table: 'log_access_windows',
        selectSql: `SELECT organization_id,ip::text AS ip,recent,alerted_at::text AS alerted_at
            FROM log_access_windows ORDER BY organization_id,ip LIMIT $1`,
        deleteSql: `DELETE FROM log_access_windows AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,ip inet,recent double precision[],alerted_at timestamptz)
            WHERE source.organization_id=expected.organization_id AND source.ip=expected.ip AND source.recent=expected.recent
              AND source.alerted_at IS NOT DISTINCT FROM expected.alerted_at RETURNING source.organization_id`,
    },
    {
        kind: 'log_access_rule_windows', table: 'log_access_rule_windows',
        selectSql: `SELECT organization_id,rule_id,ip::text AS ip,recent,alerted_at::text AS alerted_at
            FROM log_access_rule_windows ORDER BY organization_id,rule_id,ip LIMIT $1`,
        deleteSql: `DELETE FROM log_access_rule_windows AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,rule_id text,ip inet,recent double precision[],alerted_at timestamptz)
            WHERE source.organization_id=expected.organization_id AND source.rule_id=expected.rule_id AND source.ip=expected.ip
              AND source.recent=expected.recent AND source.alerted_at IS NOT DISTINCT FROM expected.alerted_at
            RETURNING source.organization_id`,
    },
    {
        kind: 'log_ingest_access_ip_minutes', table: 'log_ingest_access_ip_minutes',
        selectSql: `SELECT organization_id,bucket::text AS bucket,ip::text AS ip,hits::text AS hits
            FROM log_ingest_access_ip_minutes ORDER BY organization_id,bucket,ip LIMIT $1`,
        deleteSql: `DELETE FROM log_ingest_access_ip_minutes AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,bucket timestamptz,ip inet,hits bigint)
            WHERE source.organization_id=expected.organization_id AND source.bucket=expected.bucket
              AND source.ip=expected.ip AND source.hits=expected.hits RETURNING source.organization_id`,
    },
    {
        kind: 'log_ingest_access_minute_batches', table: 'log_ingest_access_minute_batches',
        selectSql: `SELECT batch_id::text AS batch_id,organization_id,bucket::text AS bucket,ip::text AS ip,hits::text AS hits
            FROM log_ingest_access_minute_batches ORDER BY batch_id,organization_id,bucket,ip LIMIT $1`,
        deleteSql: `DELETE FROM log_ingest_access_minute_batches AS source USING jsonb_to_recordset($1::jsonb) expected(
            batch_id uuid,organization_id text,bucket timestamptz,ip inet,hits bigint)
            WHERE source.batch_id=expected.batch_id AND source.organization_id=expected.organization_id
              AND source.bucket=expected.bucket AND source.ip=expected.ip AND source.hits=expected.hits
            RETURNING source.batch_id`,
    },
    {
        kind: 'log_ingest_access_state', table: 'log_ingest_access_state',
        selectSql: `SELECT organization_id,bucket::text AS bucket,hits::text AS hits,alerted
            FROM log_ingest_access_state ORDER BY organization_id LIMIT $1`,
        deleteSql: `DELETE FROM log_ingest_access_state AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,bucket timestamptz,hits bigint,alerted boolean)
            WHERE source.organization_id=expected.organization_id AND source.bucket=expected.bucket
              AND source.hits=expected.hits AND source.alerted=expected.alerted RETURNING source.organization_id`,
    },
    {
        kind: 'log_routine_group_state', table: 'log_routine_group_state',
        selectSql: `SELECT organization_id,rule_id,scope,recent FROM log_routine_group_state
            ORDER BY organization_id,rule_id,scope LIMIT $1`,
        deleteSql: `DELETE FROM log_routine_group_state AS source USING jsonb_to_recordset($1::jsonb) expected(
            organization_id text,rule_id text,scope text,recent jsonb)
            WHERE source.organization_id=expected.organization_id AND source.rule_id=expected.rule_id
              AND source.scope=expected.scope AND source.recent=expected.recent RETURNING source.organization_id`,
    },
    {
        kind: 'log_ingestion_canonical', table: 'log_ingestion_canonical', cursorColumn: 'key',
        selectSql: `SELECT key,organization_id,source_event_id,canonical_event_id,original,created_at::text AS created_at
            FROM log_ingestion_canonical WHERE key>$1 ORDER BY key LIMIT $2`,
        deleteSql: `DELETE FROM log_ingestion_canonical AS source USING jsonb_to_recordset($1::jsonb) expected(
            key text,organization_id text,source_event_id text,canonical_event_id text,original jsonb,created_at timestamptz)
            WHERE source.key=expected.key AND source.organization_id=expected.organization_id
              AND source.source_event_id=expected.source_event_id
              AND source.canonical_event_id IS NOT DISTINCT FROM expected.canonical_event_id
              AND source.original IS NOT DISTINCT FROM expected.original AND source.created_at=expected.created_at
            RETURNING source.key`,
    },
    {
        kind: 'log_ingestion_copies', table: 'log_ingestion_copies',
        selectSql: 'SELECT key,canonical_key,envelope,created_at::text AS created_at FROM log_ingestion_copies ORDER BY key LIMIT $1',
        deleteSql: `DELETE FROM log_ingestion_copies AS source USING jsonb_to_recordset($1::jsonb) expected(
            key text,canonical_key text,envelope jsonb,created_at timestamptz)
            WHERE source.key=expected.key AND source.canonical_key=expected.canonical_key
              AND source.envelope=expected.envelope AND source.created_at=expected.created_at RETURNING source.key`,
    },
]

const runtimeStateRelations = ['log_throughput_samples', 'log_tuning_snapshots', ...runtimeStateTransfers.map(transfer => transfer.table)]

async function migrateRuntimeStateTable(url: string, syncToken: string, transfer: RuntimeStateTransfer, deleteSource = true) {
    const relation = await withTransaction(query => query('SELECT to_regclass($1) AS relation', [`public.${transfer.table}`]))
    if (!relation.rows[0]?.relation) return 0
    let cursor = ''
    let migrated = 0
    while (true) {
        const selected = await withTransaction(async query => {
            await query('SET LOCAL statement_timeout = \'20s\'')
            return query(transfer.selectSql, transfer.cursorColumn ? [cursor, 200] : [200])
        })
        if (!selected.rows.length) break
        const rows: Array<Record<string, unknown>> = []
        for (const row of selected.rows) {
            if (Buffer.byteLength(JSON.stringify({ kind: transfer.kind, rows: [...rows, row] })) > maxPayloadBytes) break
            rows.push(row)
        }
        if (!rows.length) throw permanentError(`A ${transfer.kind} row exceeds the Logs migration payload limit; it remains in Hanasand.`)
        await sendMigrationState(url, syncToken, transfer.kind, rows)
        if (deleteSource) {
            await withTransaction(async query => {
                await query('SET LOCAL lock_timeout = \'1s\'')
                await query('SET LOCAL statement_timeout = \'20s\'')
                const deleted = await query(transfer.deleteSql, [JSON.stringify(rows)])
                if (deleted.rows.length !== rows.length) {
                    throw new Error(`A ${transfer.kind} row changed during migration; its delete transaction was rolled back.`)
                }
            })
        } else {
            if (!transfer.cursorColumn) throw new Error(`A cursor is required when retaining source ${transfer.kind} rows.`)
            cursor = String(rows[rows.length - 1]![transfer.cursorColumn])
        }
        migrated += rows.length
    }
    return migrated
}

export async function migrateLogRuntimeState(url: string, syncToken: string) {
    let migratedSamples = 0
    let sampleCursor = ''
    const samplesExist = await withTransaction(query => query('SELECT to_regclass($1) AS relation', ['public.log_throughput_samples']))
    if (samplesExist.rows[0]?.relation) while (true) {
        const selected = await withTransaction(async query => {
            await query('SET LOCAL statement_timeout = \'20s\'')
            return query(`SELECT sampled_at::text AS sampled_at,checked_count::text AS checked_count,pps,eps,historical_eps,npps,
                    remaining::text AS remaining FROM log_throughput_samples WHERE sampled_at::text>$1
                ORDER BY sampled_at LIMIT 500`, [sampleCursor])
        })
        if (!selected.rows.length) break
        const rows: Array<Record<string, unknown>> = []
        for (const row of selected.rows) {
            if (Buffer.byteLength(JSON.stringify({ kind: 'throughput_samples', rows: [...rows, row] })) > maxPayloadBytes) break
            rows.push(row)
        }
        if (!rows.length) throw permanentError('A throughput sample exceeds the Logs migration payload limit; it remains in Hanasand.')
        await sendMigrationState(url, syncToken, 'throughput_samples', rows)
        await withTransaction(async query => {
            await query('SET LOCAL lock_timeout = \'1s\'')
            await query('SET LOCAL statement_timeout = \'20s\'')
            const deleted = await query(`DELETE FROM log_throughput_samples AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    sampled_at timestamptz,checked_count bigint,pps double precision,eps double precision,
                    historical_eps double precision,npps double precision,remaining bigint)
                WHERE source.sampled_at=expected.sampled_at AND source.checked_count=expected.checked_count
                  AND source.pps=expected.pps AND source.eps=expected.eps AND source.historical_eps=expected.historical_eps
                  AND source.npps=expected.npps AND source.remaining=expected.remaining RETURNING source.sampled_at`, [JSON.stringify(rows)])
            if (deleted.rows.length !== rows.length) throw new Error('A throughput sample changed during migration; its delete transaction was rolled back.')
        })
        sampleCursor = String(rows[rows.length - 1]!.sampled_at)
        migratedSamples += rows.length
    }

    let migratedSnapshots = 0
    let organizationCursor = ''
    const snapshotsExist = await withTransaction(query => query('SELECT to_regclass($1) AS relation', ['public.log_tuning_snapshots']))
    if (snapshotsExist.rows[0]?.relation) while (true) {
        const selected = await withTransaction(async query => {
            await query('SET LOCAL statement_timeout = \'20s\'')
            return query(`SELECT organization_id,logs,generated_at::text AS generated_at,refresh_requested_at::text AS refresh_requested_at
                FROM log_tuning_snapshots WHERE organization_id>$1 ORDER BY organization_id LIMIT 200`, [organizationCursor])
        })
        if (!selected.rows.length) break
        const rows: Array<Record<string, unknown>> = []
        for (const row of selected.rows) {
            if (Buffer.byteLength(JSON.stringify({ kind: 'tuning_snapshots', rows: [...rows, row] })) > maxPayloadBytes) break
            rows.push(row)
        }
        if (!rows.length) throw permanentError('A tuning snapshot exceeds the Logs migration payload limit; it remains in Hanasand.')
        await sendMigrationState(url, syncToken, 'tuning_snapshots', rows)
        await withTransaction(async query => {
            await query('SET LOCAL lock_timeout = \'1s\'')
            await query('SET LOCAL statement_timeout = \'20s\'')
            const deleted = await query(`DELETE FROM log_tuning_snapshots AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    organization_id text,logs jsonb,generated_at timestamptz,refresh_requested_at timestamptz)
                WHERE source.organization_id=expected.organization_id AND source.logs=expected.logs
                  AND source.generated_at IS NOT DISTINCT FROM expected.generated_at
                  AND source.refresh_requested_at=expected.refresh_requested_at RETURNING source.organization_id`, [JSON.stringify(rows)])
            if (deleted.rows.length !== rows.length) throw new Error('A tuning snapshot changed during migration; its delete transaction was rolled back.')
        })
        organizationCursor = String(rows[rows.length - 1]!.organization_id)
        migratedSnapshots += rows.length
    }

    const additionalState: Record<string, number> = {}
    const canonicalTransfer = runtimeStateTransfers.find(transfer => transfer.kind === 'log_ingestion_canonical')!
    const stagedCanonicalRows = await migrateRuntimeStateTable(url, syncToken, canonicalTransfer, false)
    for (const transfer of runtimeStateTransfers) {
        if (transfer.kind === 'log_ingestion_canonical' || transfer.kind === 'log_ingestion_copies') continue
        const count = await migrateRuntimeStateTable(url, syncToken, transfer)
        if (count) additionalState[transfer.kind] = count
    }
    const copiesTransfer = runtimeStateTransfers.find(transfer => transfer.kind === 'log_ingestion_copies')!
    const copiedIngestionRows = await migrateRuntimeStateTable(url, syncToken, copiesTransfer)
    if (copiedIngestionRows) additionalState.log_ingestion_copies = copiedIngestionRows
    const deletedCanonicalRows = await migrateRuntimeStateTable(url, syncToken, canonicalTransfer)
    if (deletedCanonicalRows) additionalState.log_ingestion_canonical = deletedCanonicalRows
    else if (stagedCanonicalRows) throw new Error('Logs ingestion canonical rows disappeared before their source copy could be removed.')

    return { throughputSamples: migratedSamples, tuningSnapshots: migratedSnapshots, additionalState }
}

export async function serviceReady(url: string) {
    const signingKey = process.env.LOGS_APPLICATION_LOG_HMAC_KEY
    if (!signingKey || Buffer.byteLength(signingKey) < 32) return false
    const expectedKeyId = createHash('sha256').update(signingKey).digest('hex').slice(0, 24)
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return false
    const body = await response.json() as {
        ok?: boolean, accepting?: boolean, release?: string, applicationLogHmacReady?: boolean, applicationLogHmacKeyId?: string | null,
        worker?: { ok?: boolean, release?: string | null }
    }
    return body.ok === true && body.accepting === true && body.worker?.ok === true
        && typeof body.release === 'string' && body.worker.release === body.release
        && body.applicationLogHmacReady === true && body.applicationLogHmacKeyId === expectedKeyId
}

export async function customerLogsReadReady(logsServiceUrl: string) {
    const readinessUrl = process.env.LOGS_FRONTEND_READINESS_URL || 'https://hanasand.com/api/health'
    const apiBase = `${logsServiceUrl.replace(/\/+$/, '')}/api`
    try {
        const response = await fetch(readinessUrl, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (!response.ok) return false
        const body = await response.json() as { ok?: boolean, service?: string, logsReadBaseUrl?: string | null }
        if (body.ok !== true || body.service !== 'frontend'
            || body.logsReadBaseUrl?.trim().replace(/\/+$/, '') !== apiBase) return false

        // These user-facing routes were absent from the previous Logs API
        // release. The synthetic organization scopes rule-hit probes; a 401
        // proves each handler exists without fetching customer data.
        const routes = ['/logs/errors?organizationId=__readiness_probe__',
            '/rules/hits?organizationId=__readiness_probe__',
            '/rules/__readiness_probe__/hits?organizationId=__readiness_probe__',
            '/rules/__readiness_probe__/storage-estimate?organizationId=__readiness_probe__']
        const routeResponses = await Promise.all(routes.map(path => fetch(`${apiBase}${path}`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
        })))
        return routeResponses.every(route => route.status === 401)
    } catch {
        return false
    }
}

type MigrationTailRange = { lowerBlock: number; upperBlock: number; afterCtid?: string }

export async function moveOneBatch(url: string, token: string, cursor = '', tailRange?: MigrationTailRange): Promise<MigrationBatchResult> {
    const selected = await withTransaction(async query => {
        await query('SET LOCAL lock_timeout = \'1s\'')
        await query(`SET LOCAL statement_timeout = '${tailRange ? '5min' : '20s'}'`)
        const selected = tailRange
            ? await query(`SELECT ctid::text AS source_ctid, id, ingestion_id, organization_id, source_vendor, source_product,
                event_timestamp::text AS event_timestamp, received_at::text AS received_at,
                event_type, action, outcome, user_id, user_email, source_ip, source_country, source_city, device_id,
                normalized, original, parser_version, processing_status
            FROM events WHERE ingestion_id = 'logs'
                AND ctid >= ('(' || $1::text || ',0)')::tid AND ctid < ('(' || $2::text || ',0)')::tid
                AND ($3::tid IS NULL OR ctid > $3::tid)
            ORDER BY ctid LIMIT $4`, [tailRange.lowerBlock, tailRange.upperBlock, tailRange.afterCtid || null, batchSize])
            : await query(`SELECT id, ingestion_id, organization_id, source_vendor, source_product,
                event_timestamp::text AS event_timestamp, received_at::text AS received_at,
                event_type, action, outcome, user_id, user_email, source_ip, source_country, source_city, device_id,
                normalized, original, parser_version, processing_status
            FROM events WHERE ingestion_id = 'logs' AND id > $1
            ORDER BY id LIMIT $2`, [cursor, batchSize])
        return selected.rows
    })
    if (!selected.length) {
        if (tailRange) {
            const remaining = await withTransaction(async query => {
                await query('SET LOCAL statement_timeout = \'5min\'')
                return query(`SELECT EXISTS(SELECT 1 FROM events
                    WHERE ingestion_id='logs' AND ctid >= ('(' || $1::text || ',0)')::tid
                        AND ctid < ('(' || $2::text || ',0)')::tid) AS present`, [tailRange.lowerBlock, tailRange.upperBlock])
            })
            return remaining.rows[0]?.present
                ? { moved: 0, remaining: true, retry: true }
                : { moved: 0, remaining: true, retry: false, rangeComplete: true }
        }
        const remaining = await withTransaction(query => query('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id = \'logs\') AS present'))
        // Sweep from the beginning if a legacy writer inserted a row behind the
        // current cursor. The final pass must observe an actually empty source.
        return { moved: 0, remaining: Boolean(remaining.rows[0]?.present), retry: false,
            ...(remaining.rows[0]?.present ? { cursor: '' } : {}) }
    }

    const events: Array<ReturnType<typeof logMigrationEvent>> = []
    const sourceRows: typeof selected = []
    for (const row of selected) {
        const event = logMigrationEvent(row)
        const candidateEvents = [...events, event]
        if (Buffer.byteLength(JSON.stringify({ events: candidateEvents })) > maxPayloadBytes) break
        events.push(event)
        sourceRows.push(row)
    }
    if (!events.length) throw permanentError('The oldest source event exceeds the Logs API batch size; it remains in Hanasand for manual review.')

    await assertMigrationStorageReserve()
    const response = await fetch(`${url}/api/ingest`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(10_000),
    })
    const body = await response.json().catch(() => ({})) as {
        ok?: boolean, accepted?: number, error?: string, droppedSourceEventIds?: unknown,
        droppedEvents?: Array<{ sourceEventId?: unknown, payloadSha256?: unknown }>,
    }
    if (response.status === 503 && body.error === 'Log organization is unavailable.') {
        throw permanentError('An event belongs to a Logs organization that is missing or inactive; its source row remains in Hanasand.')
    }
    if (response.status === 429 || response.status === 503) {
        return { moved: 0, remaining: true, retry: true }
    }
    if (!response.ok || body.ok !== true || body.accepted !== events.length) {
        throw permanentError(`Logs did not acknowledge the full migration batch (HTTP ${response.status}${body.error ? `: ${body.error}` : ''}).`)
    }

    const submittedSourceIds = new Set(events.map(event => event.sourceEventId))
    const expectedPayloadHashes = new Map(events.map(event => [event.sourceEventId, migrationPayloadHash(event)]))
    const reportedDrops = body.droppedSourceEventIds === undefined ? [] : body.droppedSourceEventIds
    if (!Array.isArray(reportedDrops) || !reportedDrops.every(id => typeof id === 'string' && submittedSourceIds.has(id))
        || new Set(reportedDrops).size !== reportedDrops.length) {
        throw permanentError('Logs returned invalid dropped-event identities; source rows remain in Hanasand.')
    }
    const droppedEvents = body.droppedEvents === undefined ? [] : body.droppedEvents
    if (!Array.isArray(droppedEvents) || droppedEvents.length !== reportedDrops.length
        || droppedEvents.some(item => !item || typeof item.sourceEventId !== 'string'
            || typeof item.payloadSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.payloadSha256)
            || !reportedDrops.includes(item.sourceEventId)
            || expectedPayloadHashes.get(item.sourceEventId) !== item.payloadSha256)
        || new Set(droppedEvents.map(item => item?.sourceEventId)).size !== droppedEvents.length) {
        throw permanentError('Logs returned missing or mismatched drop payload proofs; source rows remain in Hanasand.')
    }
    const droppedSourceIds = new Set(reportedDrops as string[])
    const retainedEvents = events.filter(event => !droppedSourceIds.has(event.sourceEventId))
    const expectedPayloadHashesByTargetId = new Map(retainedEvents.map(event => [
        createHash('sha256').update(`service:${event.sourceEventId}`).digest('hex'),
        expectedPayloadHashes.get(event.sourceEventId)!,
    ]))
    const targetIds = retainedEvents.map(event => createHash('sha256').update(`service:${event.sourceEventId}`).digest('hex'))
    if (new Set(targetIds).size !== targetIds.length) {
        throw permanentError('The source batch contains duplicate Logs identities; its rows remain in Hanasand.')
    }
    const retainedTargetIds = targetIds
    if (retainedTargetIds.length) {
        const syncToken = process.env.LOGS_SERVICE_SYNC_TOKEN
        if (!syncToken || syncToken.length < 32) throw permanentError('Migration requires LOGS_SERVICE_SYNC_TOKEN to verify worker processing; source rows remain in Hanasand.')
        while (true) {
            const statusResponse = await fetch(`${url}/api/migration/status`, {
                method: 'POST',
                headers: { authorization: `Bearer ${syncToken}`, 'content-type': 'application/json' },
                body: JSON.stringify({ ids: retainedTargetIds }),
                signal: AbortSignal.timeout(10_000),
            })
            if (statusResponse.status === 429 || statusResponse.status === 503) {
                await sleep(1000)
                continue
            }
            if (!statusResponse.ok) throw permanentError(`Logs could not verify worker processing (HTTP ${statusResponse.status}); source rows remain in Hanasand.`)
            const statusBody = await statusResponse.json().catch(() => ({})) as {
                ok?: boolean, statuses?: Array<{ id?: string, status?: string, payloadSha256?: string }>
            }
            if (statusBody.ok !== true || !Array.isArray(statusBody.statuses)
                || statusBody.statuses.length !== retainedTargetIds.length) {
                throw permanentError('Logs returned an incomplete processing-status response; source rows remain in Hanasand.')
            }
            const statuses = new Map(statusBody.statuses.map(item => [String(item.id), String(item.status)]))
            if (retainedTargetIds.some(id => !statuses.has(id))) {
                throw permanentError('Logs returned processing statuses for different event IDs; source rows remain in Hanasand.')
            }
            const unfinished = [...statuses].filter(([, status]) => !['processed', 'pending'].includes(status))
            if (unfinished.length) {
                throw permanentError(`Logs has unverified event state (${unfinished[0][1]}); source rows remain in Hanasand.`)
            }
            if (statusBody.statuses.some(item => {
                const expected = item.id ? expectedPayloadHashesByTargetId.get(item.id) : undefined
                return !expected || item.payloadSha256 !== expected
            })) {
                throw permanentError('Logs returned missing or mismatched source payload hashes; source rows remain in Hanasand.')
            }
            // A pending row is already durably stored in the Logs database and
            // its payload hash matches this source row. Let the independent Logs
            // worker process it asynchronously; waiting here serializes the
            // entire source migration behind worker throughput and prevents the
            // bounded pending-event admission limit from doing its job.
            break
        }
    }

    const ids = sourceRows.map(row => String(row.id))
    const expectedRows = sourceRows.map(row => ({
        id: String(row.id), ingestion_id: row.ingestion_id, organization_id: row.organization_id,
        source_vendor: row.source_vendor, source_product: row.source_product,
        event_timestamp: String(row.event_timestamp), received_at: String(row.received_at),
        event_type: row.event_type, action: row.action, outcome: row.outcome, user_id: row.user_id,
        user_email: row.user_email, source_ip: row.source_ip, source_country: row.source_country,
        source_city: row.source_city, device_id: row.device_id, normalized: row.normalized,
        original: row.original, parser_version: row.parser_version, processing_status: row.processing_status,
    }))
    await withTransaction(async query => {
        await query('SET LOCAL lock_timeout = \'1s\'')
        await query('SET LOCAL statement_timeout = \'20s\'')
        const result = await query(`DELETE FROM events AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                id text, ingestion_id text, organization_id text, source_vendor text, source_product text,
                event_timestamp timestamptz, received_at timestamptz, event_type text, action text, outcome text,
                user_id text, user_email text, source_ip text, source_country text, source_city text, device_id text,
                normalized jsonb, original jsonb, parser_version text, processing_status text)
            WHERE source.id=expected.id AND source.ingestion_id='logs' AND expected.ingestion_id='logs'
              AND source.organization_id=expected.organization_id
              AND source.source_vendor IS NOT DISTINCT FROM expected.source_vendor
              AND source.source_product IS NOT DISTINCT FROM expected.source_product
              AND source.event_timestamp=expected.event_timestamp
              AND source.received_at=expected.received_at
              AND source.event_type IS NOT DISTINCT FROM expected.event_type
              AND source.action IS NOT DISTINCT FROM expected.action
              AND source.outcome IS NOT DISTINCT FROM expected.outcome
              AND source.user_id IS NOT DISTINCT FROM expected.user_id
              AND source.user_email IS NOT DISTINCT FROM expected.user_email
              AND source.source_ip IS NOT DISTINCT FROM expected.source_ip
              AND source.source_country IS NOT DISTINCT FROM expected.source_country
              AND source.source_city IS NOT DISTINCT FROM expected.source_city
              AND source.device_id IS NOT DISTINCT FROM expected.device_id
              AND source.normalized=expected.normalized
              AND source.original IS NOT DISTINCT FROM expected.original
              AND source.parser_version IS NOT DISTINCT FROM expected.parser_version
              AND source.processing_status IS NOT DISTINCT FROM expected.processing_status
            RETURNING source.id`, [JSON.stringify(expectedRows)])
        if (result.rows.length !== ids.length) {
            throw new Error('The source event batch changed before it could be removed; no changed rows were deleted.')
        }
        return result
    })
    return { moved: ids.length, remaining: true, retry: false,
        ...(tailRange ? { tailCursor: String(sourceRows[sourceRows.length - 1]!.source_ctid) } : {}),
        ...(!tailRange ? { cursor: String(sourceRows[sourceRows.length - 1]!.id) } : {}) }
}

export async function migrateEventsByPhysicalTail(url: string, token: string,
    vacuumTail: (table: 'events' | 'log_analyze_receipts') => void = runMigrationTailVacuum,
    tailChunkBytes = eventTailChunkBytes) {
    let moved = 0
    let retryDelay = 1000
    let upperBlock: number | undefined
    let blockSize = 8192

    while (true) {
        if (upperBlock === undefined) {
            const geometry = await withTransaction(query => query(`SELECT pg_relation_size('public.events')::bigint AS bytes,
                current_setting('block_size')::integer AS block_size`))
            const bytes = Number(geometry.rows[0]?.bytes)
            blockSize = Number(geometry.rows[0]?.block_size)
            const firstRange = migrationTailPageRange(bytes, blockSize, undefined, tailChunkBytes)
            if (!firstRange) {
                const remaining = await withTransaction(query => query('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id=\'logs\') AS present'))
                if (!remaining.rows[0]?.present) return moved
                await sleep(retryDelay)
                retryDelay = Math.min(30_000, retryDelay * 2)
                continue
            }
            upperBlock = firstRange.upperBlock
        }

        const range = migrationTailPageRange(upperBlock * blockSize, blockSize, upperBlock, tailChunkBytes)
        if (!range) {
            const remaining = await withTransaction(query => query('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id=\'logs\') AS present'))
            if (!remaining.rows[0]?.present) return moved
            // A late writer inserted into a previously visited physical range.
            // Refresh the relation geometry and sweep again before final cleanup.
            upperBlock = undefined
            continue
        }

        let rangeComplete = false
        let afterCtid: string | undefined
        while (!rangeComplete) {
            let result: MigrationBatchResult
            try {
                result = await moveOneBatch(url, token, '', { ...range, afterCtid })
            } catch (error) {
                if ((error as { migrationPermanent?: boolean }).migrationPermanent) throw error
                const code = String((error as { code?: string }).code || '')
                const name = String((error as { name?: string }).name || '')
                if (!code.startsWith('08') && !['40001', '40P01', '55P03', '57014', 'DB_QUEUE_FULL'].includes(code)
                    && !['AbortError', 'TimeoutError'].includes(name) && !(error instanceof TypeError)) throw error
                console.warn('Migration batch was not removed from Hanasand; retrying.', error instanceof Error ? error.message : 'unknown error')
                await sleep(retryDelay)
                retryDelay = Math.min(30_000, retryDelay * 2)
                continue
            }
            if (result.retry) {
                afterCtid = undefined
                await sleep(retryDelay)
                retryDelay = Math.min(30_000, retryDelay * 2)
                continue
            }
            retryDelay = 1000
            if (result.moved) {
                moved += result.moved
                if (moved % 1000 === 0) console.log(JSON.stringify({ moved, scope: 'logs events' }))
            }
            if (result.tailCursor) afterCtid = result.tailCursor
            rangeComplete = result.rangeComplete === true
            if (!rangeComplete && result.moved === 0 && !result.remaining) {
                // A concurrent writer may have changed the relation while the
                // range was being walked. Check the whole table before restarting.
                const remaining = await withTransaction(query => query('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id=\'logs\') AS present'))
                if (!remaining.rows[0]?.present) return moved
                upperBlock = undefined
                break
            }
        }

        if (rangeComplete) {
            vacuumTail('events')
            upperBlock = range.lowerBlock
        }
    }
}

async function main() {
    if (!apply) {
        const [eventEstimate, tables] = await Promise.all([
            queryOnce('EXPLAIN (FORMAT JSON) SELECT id FROM public.events WHERE ingestion_id = \'logs\''),
            queryOnce(`SELECT c.relname AS table, GREATEST(c.reltuples, 0)::bigint AS estimated_rows,
                    pg_total_relation_size(c.oid)::bigint AS total_bytes,
                    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
                FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relkind IN ('r','m','p')
                  AND (left(c.relname, 4) = 'log_' OR c.relname IN (
                    'events','findings','rules','rule_hit_counts','rule_hit_count_deltas','rule_hit_count_state'))
                ORDER BY pg_total_relation_size(c.oid) DESC, c.relname`),
        ])
        console.log(JSON.stringify({ mode: 'dry-run', scope: 'events WHERE ingestion_id=\'logs\'',
            estimatedLogEventRows: estimatedPlanRows(eventEstimate.rows[0]?.['QUERY PLAN']),
            eventEstimateMethod: 'PostgreSQL planner estimate; verify with exact counts before deletion',
            eventRelationSizeIncludesOtherIngestions: true,
            relatedTableSizes: tables.rows, batchSize,
            applyRequires: ['LOGS_OUTBOX_ENABLED=1', 'LOGS_OUTBOX_REMOTE_ONLY=1', 'LOGS_SERVICE_DIRECT=1 with a valid application-log HMAC key', 'live frontend Logs read cutover', 'healthy Logs API and worker'] }))
        return
    }

    if (!logsOutboxEnabled() || !logsOutboxRemoteOnly() || !logsServiceDirect()) {
        throw new Error('Apply requires enabled Logs outbox delivery, remote-only processing and direct signed collector output.')
    }
    const { url, ingestToken, syncToken } = logsServiceConfiguration()
    if (!url || !ingestToken || ingestToken.length < 32 || !syncToken || syncToken.length < 32) throw new Error('Apply requires LOGS_SERVICE_URL and valid Logs ingest and sync tokens.')
    if (!await customerLogsReadReady(url)) throw new Error('Apply requires the live Hanasand frontend to report Logs reads routed to the target Logs service and every direct read route to be active.')
    if (!await serviceReady(url)) throw new Error('Logs API or worker is not healthy; no source rows were moved.')
    const receipts = await migrateAnalysisReceipts(url, syncToken)
    const linkageArchiveRows = await migrateLinkageArchive(url, syncToken)
    const runtimeState = await migrateLogRuntimeState(url, syncToken)
    console.log(JSON.stringify({ migratedReceipts: receipts, linkageArchiveRows, runtimeState }))
    const findings = await migrateFindingsBeforeEvents(url, syncToken)
    console.log(JSON.stringify({ preparedFindings: findings, scope: 'logs findings' }))
    if (!await customerLogsReadReady(url)) throw new Error('The live Hanasand frontend no longer routes Logs reads to this service; receipt storage remains in Hanasand.')
    const reclaimedReceiptTables = await clearMigratedLogReceipts()
    console.log(JSON.stringify({ reclaimedReceiptTables, scope: 'migrated Logs receipts and hit counts' }))

    const moved = await migrateEventsByPhysicalTail(url, ingestToken)
    if (!await serviceReady(url)) throw new Error('Logs API or worker became unhealthy before source cleanup; log state remains in Hanasand.')
    if (!await customerLogsReadReady(url)) throw new Error('The live Hanasand frontend no longer routes Logs reads to this service; source log state remains in Hanasand.')
    const clearedTables = await clearMovedLogState()
    console.log(JSON.stringify({ complete: true, moved, scope: 'logs events', clearedTables,
        physicalRewriteRequired: ['events', 'findings'].filter(table => !clearedTables.includes(table)) }))
}

if (import.meta.main) {
    main().catch(error => {
        console.error('Logs migration stopped without deleting an unacknowledged batch:', error instanceof Error ? error.message : 'unknown error')
        process.exitCode = 1
    })
}
