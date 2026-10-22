import { queryOnce, withTransaction } from '#db'
import { createHash } from 'node:crypto'
import { logsServiceConfiguration, logsOutboxEnabled, logsOutboxRemoteOnly } from '../src/utils/logs/logOutboxConfig.ts'
import { logMigrationEvent } from '../src/utils/logs/logMigrationEvent.ts'

const batchSize = Math.max(1, Math.min(200, Number(process.env.LOGS_MIGRATION_BATCH_SIZE) || 100))
const receiptBatchSize = 100
const findingScanSize = 10_000
const apply = process.argv.includes('--apply')
const maxPayloadBytes = 450_000
const migrationCursorIndex = 'idx_events_logs_migration_cursor'
const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))
type MigrationBatchResult = { moved: number, remaining: boolean, retry: boolean }

export function estimatedPlanRows(plan: unknown): number | null {
    const value = Array.isArray(plan) ? plan[0] : plan
    if (!value || typeof value !== 'object') return null
    const root = (value as { Plan?: unknown }).Plan
    if (!root || typeof root !== 'object') return null
    const rows = Number((root as { 'Plan Rows'?: unknown })['Plan Rows'])
    return Number.isSafeInteger(rows) && rows >= 0 ? rows : null
}

function permanentError(message: string) {
    return Object.assign(new Error(message), { migrationPermanent: true })
}

export async function ensureMigrationCursorIndex(query = queryOnce) {
    const existing = await query(`SELECT i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid) AS definition
        FROM pg_index i WHERE i.indexrelid=to_regclass($1)`, [migrationCursorIndex])
    const index = existing.rows[0]
    if (index && (!index.indisvalid || !index.indisready)) {
        await query(`DROP INDEX CONCURRENTLY IF EXISTS ${migrationCursorIndex}`)
    }
    await query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${migrationCursorIndex}
        ON public.events (received_at, id) WHERE ingestion_id='logs'`)
    const verified = await query(`SELECT i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid) AS definition
        FROM pg_index i WHERE i.indexrelid=to_regclass($1)`, [migrationCursorIndex])
    const created = verified.rows[0]
    if (!created?.indisvalid || !created?.indisready
        || !String(created.definition).includes('(received_at, id)')
        || !String(created.definition).includes('ingestion_id')
        || !String(created.definition).includes('\'logs\'')) {
        throw new Error('The temporary Logs migration cursor index is missing or invalid; no migration rows were deleted.')
    }
}

export async function dropMigrationCursorIndex(query = queryOnce) {
    await query(`DROP INDEX CONCURRENTLY IF EXISTS ${migrationCursorIndex}`)
}

const keepLogTables = ['log_delivery_outbox', 'log_organization_sync_outbox', 'log_organization_sync_cursor']

export async function clearMovedLogState(transaction = withTransaction) {
    return transaction(async query => {
        await query('SET LOCAL lock_timeout = \'2s\'')
        await query('SET LOCAL statement_timeout = \'5min\'')
        await query('LOCK TABLE events, findings, rule_hit_counts, rule_hit_count_deltas IN SHARE ROW EXCLUSIVE MODE')
        const remaining = await query('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id=\'logs\') AS present')
        if (remaining.rows[0]?.present) {
            throw new Error('Cannot clear Hanasand Logs state while source log events remain.')
        }
        const tables = await query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relkind='r' AND left(c.relname,4)='log_'
              AND NOT (c.relname=ANY($1::text[])) ORDER BY c.relname`, [keepLogTables])
        const cleared = tables.rows.map(row => String(row.relname))
        for (const name of cleared) {
            if (!/^log_[a-z0-9_]+$/.test(name)) throw new Error('Unexpected log state relation name; cleanup stopped.')
        }
        if (cleared.length) await query(`TRUNCATE TABLE ${cleared.map(name => `public.${name}`).join(', ')}`)
        await query('TRUNCATE TABLE rule_hit_counts')
        await query('TRUNCATE TABLE rule_hit_count_deltas RESTART IDENTITY')
        await query(`INSERT INTO rule_hit_counts(organization_id,source,rule_id,hits)
            SELECT organization_id,'findings',rule_id,count(*) FROM findings GROUP BY organization_id,rule_id`)
        await query(`INSERT INTO rule_hit_count_deltas(organization_id,source,rule_id,delta)
            SELECT organization_id,source,rule_id,hits FROM rule_hit_counts WHERE hits > 0`)
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

export async function migrateReceiptKind(url: string, syncToken: string, kind: 'model_probe' | 'readiness_audit' | 'proxy') {
    const modelProbe = kind === 'model_probe'
    const readinessAudit = kind === 'readiness_audit'
    const table = modelProbe ? 'log_model_probe_receipts' : readinessAudit ? 'log_readiness_audit_receipts' : 'log_proxy_receipts'
    const keyColumn = modelProbe ? 'nonce' : readinessAudit ? 'exec_id' : 'key'
    let cursor = ''
    let migrated = 0
    while (true) {
        const source = await withTransaction(async query => {
            await query('SET LOCAL statement_timeout = \'20s\'')
            const fields = modelProbe
                ? 'nonce,source_event_id,organization_id,original,original_encoding,created_at::text AS created_at'
                : readinessAudit ? 'exec_id,organization_id,root_source_event_id,chain_digest,original,original_encoding,created_at::text AS created_at'
                    : 'key,organization_id,connection_id::text AS connection_id,canonical_event_id,original,created_at::text AS created_at'
            return query(`SELECT ${fields} FROM ${table} WHERE ${keyColumn} > $1 ORDER BY ${keyColumn} LIMIT $2`, [cursor, receiptBatchSize])
        })
        if (!source.rows.length) return migrated

        const batch: Array<Record<string, unknown>> = []
        for (const row of source.rows) {
            const { original, ...fields } = row
            const receipt = kind === 'proxy' ? row : { ...fields, original_base64: Buffer.from(original).toString('base64') }
            if (Buffer.byteLength(JSON.stringify({ kind, receipts: [...batch, receipt] })) > maxPayloadBytes) break
            batch.push(receipt)
        }
        if (!batch.length) throw permanentError(`The oldest ${kind} receipt exceeds the Logs migration payload limit; it remains in Hanasand.`)

        let acknowledged = false
        let retryDelay = 1000
        while (!acknowledged) {
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
            return query(`DELETE FROM log_proxy_receipts AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    key text,organization_id text,connection_id uuid,canonical_event_id text,original jsonb,created_at timestamptz)
                WHERE source.key=expected.key AND source.organization_id=expected.organization_id
                  AND source.connection_id=expected.connection_id AND source.canonical_event_id=expected.canonical_event_id
                  AND source.original=expected.original AND source.created_at=expected.created_at
                RETURNING source.key`, [JSON.stringify(batch)])
        })
        if (deletion.rows.length !== batch.length) throw new Error(`A ${kind} receipt changed during migration; its delete transaction was rolled back.`)
        migrated += batch.length
        cursor = String(batch[batch.length - 1]![keyColumn])
    }
}

export async function migrateAnalysisReceipts(url: string, syncToken: string) {
    const modelProbe = await migrateReceiptKind(url, syncToken, 'model_probe')
    const readinessAudit = await migrateReceiptKind(url, syncToken, 'readiness_audit')
    const proxy = await migrateReceiptKind(url, syncToken, 'proxy')
    return { modelProbe, readinessAudit, proxy }
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

        const deleted = await withTransaction(async query => {
            await query('SET LOCAL lock_timeout = \'1s\'')
            await query('SET LOCAL statement_timeout = \'20s\'')
            return query(`DELETE FROM log_analyze_event_linkage_archive AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    organization_id text,event_id text,rule_id text,event_timestamp timestamptz,host text,process_pid text,
                    parent_pid text,executable text,caller_executable text,user_id text,login_id text,audit_id text,archived_at timestamptz)
                WHERE source.organization_id=expected.organization_id AND source.event_id=expected.event_id AND source.rule_id=expected.rule_id
                  AND source.event_timestamp IS NOT DISTINCT FROM expected.event_timestamp AND source.host IS NOT DISTINCT FROM expected.host
                  AND source.process_pid IS NOT DISTINCT FROM expected.process_pid AND source.parent_pid IS NOT DISTINCT FROM expected.parent_pid
                  AND source.executable IS NOT DISTINCT FROM expected.executable AND source.caller_executable IS NOT DISTINCT FROM expected.caller_executable
                  AND source.user_id IS NOT DISTINCT FROM expected.user_id AND source.login_id IS NOT DISTINCT FROM expected.login_id
                  AND source.audit_id IS NOT DISTINCT FROM expected.audit_id AND source.archived_at=expected.archived_at
                RETURNING source.organization_id,source.event_id`, [JSON.stringify(rows)])
        })
        if (deleted.rows.length !== rows.length) throw new Error('A linkage archive row changed during migration; its delete transaction was rolled back.')
        const last = rows[rows.length - 1]!
        organizationCursor = String(last.organization_id)
        eventCursor = String(last.event_id)
        migrated += rows.length
    }
}

async function sendMigrationState(url: string, syncToken: string, kind: 'throughput_samples' | 'tuning_snapshots', rows: Array<Record<string, unknown>>) {
    let retryDelay = 1000
    while (true) {
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
        const deleted = await withTransaction(async query => {
            await query('SET LOCAL lock_timeout = \'1s\'')
            await query('SET LOCAL statement_timeout = \'20s\'')
            return query(`DELETE FROM log_throughput_samples AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    sampled_at timestamptz,checked_count bigint,pps double precision,eps double precision,
                    historical_eps double precision,npps double precision,remaining bigint)
                WHERE source.sampled_at=expected.sampled_at AND source.checked_count=expected.checked_count
                  AND source.pps=expected.pps AND source.eps=expected.eps AND source.historical_eps=expected.historical_eps
                  AND source.npps=expected.npps AND source.remaining=expected.remaining RETURNING source.sampled_at`, [JSON.stringify(rows)])
        })
        if (deleted.rows.length !== rows.length) throw new Error('A throughput sample changed during migration; its delete transaction was rolled back.')
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
        const deleted = await withTransaction(async query => {
            await query('SET LOCAL lock_timeout = \'1s\'')
            await query('SET LOCAL statement_timeout = \'20s\'')
            return query(`DELETE FROM log_tuning_snapshots AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                    organization_id text,logs jsonb,generated_at timestamptz,refresh_requested_at timestamptz)
                WHERE source.organization_id=expected.organization_id AND source.logs=expected.logs
                  AND source.generated_at IS NOT DISTINCT FROM expected.generated_at
                  AND source.refresh_requested_at=expected.refresh_requested_at RETURNING source.organization_id`, [JSON.stringify(rows)])
        })
        if (deleted.rows.length !== rows.length) throw new Error('A tuning snapshot changed during migration; its delete transaction was rolled back.')
        organizationCursor = String(rows[rows.length - 1]!.organization_id)
        migratedSnapshots += rows.length
    }
    return { throughputSamples: migratedSamples, tuningSnapshots: migratedSnapshots }
}

async function serviceReady(url: string) {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return false
    const body = await response.json() as { ok?: boolean }
    return body.ok === true
}

export async function moveOneBatch(url: string, token: string): Promise<MigrationBatchResult> {
    const selected = await withTransaction(async query => {
        await query('SET LOCAL lock_timeout = \'1s\'')
        await query('SET LOCAL statement_timeout = \'20s\'')
        const selected = await query(`SELECT id, organization_id, event_timestamp::text AS event_timestamp, normalized
            FROM events WHERE ingestion_id = 'logs'
            ORDER BY received_at, id LIMIT $1`, [batchSize])
        return selected.rows
    })
    if (!selected.length) {
        const remaining = await withTransaction(query => query('SELECT EXISTS(SELECT 1 FROM events WHERE ingestion_id = \'logs\') AS present'))
        return { moved: 0, remaining: Boolean(remaining.rows[0]?.present), retry: false }
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

    const response = await fetch(`${url}/api/ingest`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(10_000),
    })
    const body = await response.json().catch(() => ({})) as { ok?: boolean, accepted?: number, error?: string, droppedSourceEventIds?: unknown }
    if (response.status === 503 && body.error === 'Log organization is unavailable.') {
        throw permanentError('An event belongs to a Logs organization that is missing or inactive; its source row remains in Hanasand.')
    }
    if (response.status === 429 || response.status === 503) {
        return { moved: 0, remaining: true, retry: true }
    }
    if (!response.ok || body.ok !== true || body.accepted !== events.length) {
        throw permanentError(`Logs did not acknowledge the full migration batch (HTTP ${response.status}${body.error ? `: ${body.error}` : ''}).`)
    }

    const targetIds = events.map(event => createHash('sha256').update(`service:${event.sourceEventId}`).digest('hex'))
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
                ok?: boolean, statuses?: Array<{ id?: string, status?: string }>
            }
            if (statusBody.ok !== true || !Array.isArray(statusBody.statuses)
                || statusBody.statuses.length !== retainedTargetIds.length) {
                throw permanentError('Logs returned an incomplete processing-status response; source rows remain in Hanasand.')
            }
            const statuses = new Map(statusBody.statuses.map(item => [String(item.id), String(item.status)]))
            if (retainedTargetIds.some(id => !statuses.has(id))) {
                throw permanentError('Logs returned processing statuses for different event IDs; source rows remain in Hanasand.')
            }
            if ([...statuses.values()].some(status => status === 'pending')) {
                await sleep(1000)
                continue
            }
            const unfinished = [...statuses].filter(([, status]) => !['processed', 'dropped'].includes(status))
            if (unfinished.length) {
                throw permanentError(`Logs has unverified event state (${unfinished[0][1]}); source rows remain in Hanasand.`)
            }
            break
        }
    }

    const ids = sourceRows.map(row => String(row.id))
    const expectedRows = sourceRows.map(row => ({ id: String(row.id), organization_id: row.organization_id,
        event_timestamp: String(row.event_timestamp), normalized: row.normalized }))
    const deleted = await withTransaction(async query => {
        await query('SET LOCAL lock_timeout = \'1s\'')
        await query('SET LOCAL statement_timeout = \'20s\'')
        return query(`DELETE FROM events AS source USING jsonb_to_recordset($1::jsonb) AS expected(
                id text, organization_id text, event_timestamp timestamptz, normalized jsonb)
            WHERE source.id=expected.id AND source.ingestion_id='logs'
              AND source.organization_id=expected.organization_id
              AND source.event_timestamp=expected.event_timestamp
              AND source.normalized=expected.normalized
            RETURNING source.id`, [JSON.stringify(expectedRows)])
    })
    if (deleted.rows.length !== ids.length) throw new Error('The source event batch changed before it could be removed; no changed rows were deleted.')
    return { moved: ids.length, remaining: true, retry: false }
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
            applyRequires: ['LOGS_OUTBOX_ENABLED=1', 'LOGS_OUTBOX_REMOTE_ONLY=1', 'healthy Logs API and worker'] }))
        return
    }

    if (!logsOutboxEnabled() || !logsOutboxRemoteOnly()) {
        throw new Error('Apply requires LOGS_OUTBOX_ENABLED=1 and LOGS_OUTBOX_REMOTE_ONLY=1 so new application logs continue directly to Logs.')
    }
    const { url, ingestToken, syncToken } = logsServiceConfiguration()
    if (!url || !ingestToken || ingestToken.length < 32 || !syncToken || syncToken.length < 32) throw new Error('Apply requires LOGS_SERVICE_URL and valid Logs ingest and sync tokens.')
    if (!await serviceReady(url)) throw new Error('Logs API or worker is not healthy; no source rows were moved.')
    await ensureMigrationCursorIndex()
    const receipts = await migrateAnalysisReceipts(url, syncToken)
    const linkageArchiveRows = await migrateLinkageArchive(url, syncToken)
    const runtimeState = await migrateLogRuntimeState(url, syncToken)
    console.log(JSON.stringify({ migratedReceipts: receipts, linkageArchiveRows, runtimeState }))
    const findings = await migrateFindingsBeforeEvents(url, syncToken)
    console.log(JSON.stringify({ preparedFindings: findings, scope: 'logs findings' }))

    let moved = 0
    let retryDelay = 1000
    while (true) {
        let result: Awaited<ReturnType<typeof moveOneBatch>>
        try {
            result = await moveOneBatch(url, ingestToken)
        } catch (error) {
            if ((error as { migrationPermanent?: boolean }).migrationPermanent) throw error
            const code = String((error as { code?: string }).code || '')
            const name = String((error as { name?: string }).name || '')
            if (!code.startsWith('08') && !['40001', '40P01', '55P03', '57014', 'DB_QUEUE_FULL'].includes(code)
                && !['AbortError', 'TimeoutError'].includes(name) && !(error instanceof TypeError)) throw error
            // Source rows remain unless the acknowledged and processed batch was
            // unchanged at the final conditional delete.
            console.warn('Migration batch was not removed from Hanasand; retrying.', error instanceof Error ? error.message : 'unknown error')
            await sleep(retryDelay)
            retryDelay = Math.min(30_000, retryDelay * 2)
            continue
        }
        if (result.retry) {
            await sleep(retryDelay)
            retryDelay = Math.min(30_000, retryDelay * 2)
            continue
        }
        retryDelay = 1000
        if (result.moved) {
            moved += result.moved
            if (moved % 1000 === 0) console.log(JSON.stringify({ moved, scope: 'logs events' }))
        } else if (!result.remaining) {
            if (!await serviceReady(url)) throw new Error('Logs API or worker became unhealthy before source cleanup; log state remains in Hanasand.')
            const clearedTables = await clearMovedLogState()
            await dropMigrationCursorIndex()
            console.log(JSON.stringify({ complete: true, moved, scope: 'logs events', clearedTables,
                physicalRewriteRequired: ['events', 'findings'] }))
            return
        } else {
            // Another active worker or migration owns the remaining row locks.
            await sleep(1000)
        }
    }
}

if (import.meta.main) {
    main().catch(error => {
        console.error('Logs migration stopped without deleting an unacknowledged batch:', error instanceof Error ? error.message : 'unknown error')
        process.exitCode = 1
    })
}
