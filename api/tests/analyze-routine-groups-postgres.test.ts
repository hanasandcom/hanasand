import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { createHash } from 'node:crypto'
import { telemetryFixture, sshFixture } from './analyze-routine-groups-fixtures.ts'
import { telemetryRuleId, sshWindowRuleId, telemetryDefinition, sshWindowDefinition } from '../src/utils/events/analyzeRoutineGroups.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('real group ingestion preserves suspicious originals, findings, replay and rollback', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Local disposable port required')
    const namespace = `routine_filter_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ options: `-c search_path=${namespace}`, host: '127.0.0.1', port, database: 'postgres_filter_test', max: 4 })
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
    const tx = async (work: (q: typeof query) => Promise<unknown>) => {
        const client = await pool.connect()
        try { await client.query('BEGIN'); const value = await work((s, p) => client.query(s, p)); await client.query('COMMIT'); return value }
        catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    const identityQueryOnce = (sql: string, values?: unknown[]) => query(sql.replace('public.system_events', 'system_events'), values)
    mock.module('#db', () => ({
        default: query,
        identityQueryOnce,
        isTransientDatabaseError: () => false,
        withDatabaseAdvisoryLock: async (_key: string, work: (query: typeof query) => unknown) => work(query),
        withTransaction: tx,
    }))
    mock.module('#constants', () => ({ default: {} }))
    try {
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query('CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT \'{}\')')
        await query('INSERT INTO organizations(id,name,status) VALUES(\'platform\',\'Hanasand\',\'active\')')
        const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
        for (const table of ['events', 'rules', 'system_events']) {
            const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
            if (!definition) throw new Error(`Missing schema ${table}`)
            await query(definition)
        }
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        const { collectEventFindings, normalizeEvent } = await import('../src/handlers/events.ts')
        const { normalizeLogEvent } = await import('../src/utils/events/logEvent.ts')
        await install()
        for (const [id, definition] of [[telemetryRuleId, telemetryDefinition], [sshWindowRuleId, sshWindowDefinition]]) await query('UPDATE rules SET definition=$2 WHERE rule_id=$1', [id, JSON.stringify(definition)])
        const ingest = (rows: any[]) => tx(q => recordLogBatch(rows, q as any))
        const eventIds = (rows: any[]) => rows.map(row => createHash('sha256').update(`service:${row.sourceEventId}`).digest('hex'))
        const countEvents = async (rows: any[]) => Number((await query('SELECT count(*) FROM events WHERE id=ANY($1::text[])', [eventIds(rows)])).rows[0].count)
        const logs = telemetryFixture()
        await ingest(logs)
        await ingest(logs)
        let stored = (await query('SELECT normalized FROM events WHERE normalized->>\'service\'=\'routine-group-analyzer\'')).rows
        expect(stored).toHaveLength(1)
        expect(await countEvents(logs)).toBe(0)
        expect(stored[0].normalized.metadata.original_records).toEqual(logs)
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe('3')
        const rule: any = { id: 'owned.original', source: 'owned', enabled: true, version: '1', severity: 'high', name: 'Original detector', explanation: 'test', definition: { match: 'all', conditions: [{ path: 'service', operator: 'equals', value: 'systemd' }] } }
        const findings = collectEventFindings('platform', 'canonical', normalizeEvent(stored[0].normalized, {}), [rule]).findings
        expect(findings).toHaveLength(1)
        expect(findings[0][2]).toBe('high')
        expect(findings[0][4]).toEqual(['canonical'])
        expect((findings[0][5].retainedOriginals as any[]).map(x => x.message)).toEqual(logs.map(x => x.message))
        // A competing transaction cannot claim the same group. The fallback
        // stores every original raw event and creates no second summary.
        const contended = telemetryFixture().map((row, i) => ({ ...row, sourceEventId: createHash('sha256').update(`lock-contention-${i}`).digest('hex') }))
        const lockHolder = await pool.connect()
        try {
            await lockHolder.query('BEGIN')
            await lockHolder.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`routine:platform:${telemetryRuleId}:inspur:hanasand-host-metrics.service`])
            await ingest(contended)
            expect(await countEvents(contended)).toBe(3)
            expect((await query('SELECT count(*) FROM events WHERE normalized->>\'service\'=\'routine-group-analyzer\'')).rows[0].count).toBe('1')
        } finally {
            await lockHolder.query('ROLLBACK')
            lockHolder.release()
        }
        // Suspicious content must stay byte-for-byte in the ordinary raw path.
        const suspicious = telemetryFixture().map((row, i) => ({ ...row, sourceEventId: ['a','b','c'][i].repeat(64) }))
        suspicious[1].message += ' suspicious payload'
        await ingest(suspicious)
        const suspiciousEvent = await query('SELECT normalized->>\'message\' AS message FROM events WHERE id=$1', [eventIds([suspicious[1]])[0]])
        expect(suspiciousEvent.rows[0].message).toBe(suspicious[1].message)
        const ssh = sshFixture().map((row, i) => ({ ...row, sourceEventId: ['d','e','f','9'][i].repeat(64) }))
        await ingest(ssh)
        stored = (await query('SELECT normalized FROM events WHERE normalized->\'metadata\'->>\'rule_id\'=$1', [sshWindowRuleId])).rows
        expect(stored).toHaveLength(1)
        expect(stored[0].normalized.metadata.original_records).toEqual(ssh.slice(1, -1))
        expect(await countEvents([ssh[0], ssh[3]])).toBe(2)
        const before = (await query('SELECT count(*) FROM events')).rows[0].count
        await expect(tx(async q => { await recordLogBatch([{ ...ssh[1], sourceEventId: '8'.repeat(64), message: 'Failed password for root from 192.0.2.20' }] as any, q as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect((await query('SELECT count(*) FROM events')).rows[0].count).toBe(before)
        // Current custom detector forces raw storage before any consolidation.
        await query('INSERT INTO rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled) VALUES(\'detector\',\'platform\',\'owned.original\',\'1\',\'Original detector\',\'System\',\'high\',\'Test\', $1,\'owned\',true)', [JSON.stringify(rule.definition)])
        await query('DELETE FROM log_routine_group_state')
        const detected = telemetryFixture().map((row, i) => ({ ...row, sourceEventId: ['7','6','5'][i].repeat(64) }))
        await ingest(detected)
        expect(await countEvents(detected)).toBe(3)
        await query('DELETE FROM rules WHERE id=\'detector\'')
        await query('DELETE FROM log_routine_group_state')
        const freshRows = (label: string, time: number) => telemetryFixture(time).map((row, i) => ({ ...row, sourceEventId: createHash('sha256').update(label + i).digest('hex') }))
        const now = Date.now(), burst = [...freshRows('burst-a', now - 500), ...freshRows('burst-b', now)]
        const receiptBefore = (await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count
        await ingest(burst)
        expect(await countEvents(burst)).toBe(6)
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe(receiptBefore)
        await query('DELETE FROM log_routine_group_state')
        await query('INSERT INTO rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled) VALUES(\'keep\',\'platform\',\'owned.keep\',\'1\',\'Keep\',\'System\',\'low\',\'Test\',$1,\'owned\',true)', [JSON.stringify({ match:'all',stage:'analyze',action:'keep',conditions:[{path:'service',operator:'equals',value:'systemd'}] })])
        const kept = freshRows('keep', Date.now())
        await ingest(kept)
        expect(await countEvents(kept)).toBe(3)
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe(receiptBefore)
        await query('DELETE FROM rules WHERE id=\'keep\'')
        // Current persisted policy must also protect previously receipted data.
        const receiptsBeforePolicy = (await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count
        await query('UPDATE rules SET definition=$2 WHERE rule_id=$1', [sshWindowRuleId, JSON.stringify({ ...sshWindowDefinition, conditions: [{ path:'message', operator:'contains', value:'debug2' }] })])
        await ingest(ssh)
        expect(await countEvents(ssh)).toBe(4)
        await query('UPDATE rules SET definition=$2 WHERE rule_id=$1', [telemetryRuleId, JSON.stringify({ ...telemetryDefinition, conditions: [{ path:'host', operator:'equals', value:'other-host' }] })])
        await ingest(logs)
        expect(await countEvents(logs)).toBe(3)
        await query('UPDATE rules SET definition=$2 WHERE rule_id=$1', [telemetryRuleId, JSON.stringify({ ...telemetryDefinition, parameters: { ...telemetryDefinition.parameters, maxDurationMs: 100 } })])
        const limited = freshRows('policy-duration', Date.now())
        await ingest(limited)
        expect(await countEvents(limited)).toBe(3)
        await query('DELETE FROM log_routine_group_state')
        await query('UPDATE rules SET definition=$2 WHERE rule_id=$1', [telemetryRuleId, JSON.stringify({ ...telemetryDefinition, parameters: { ...telemetryDefinition.parameters, maxPerMinute: 1 } })])
        const policyBurst = [...freshRows('policy-rate-a', Date.now() - 2000), ...freshRows('policy-rate-b', Date.now())]
        await ingest(policyBurst)
        expect(await countEvents(policyBurst)).toBe(6)
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe(receiptsBeforePolicy)
        const { analyzeRoutineGroupBatch } = await import('../src/utils/events/analyzeRoutineGroupBatch.ts')
        await query('DELETE FROM log_routine_group_state')
        for (const [id, definition] of [[telemetryRuleId, telemetryDefinition], [sshWindowRuleId, sshWindowDefinition]]) await query('UPDATE rules SET definition=$2 WHERE rule_id=$1', [id, JSON.stringify(definition)])
        const replayTelemetry = freshRows('stored-replay', Date.now())
        const replaySsh = sshFixture().map((row, i) => ({ ...row, sourceEventId: createHash('sha256').update('stored-ssh' + i).digest('hex') }))
        const storedInput = [...replayTelemetry, ...replaySsh]
        for (const row of storedInput) {
            const normalized = { ...normalizeLogEvent({ id: row.sourceEventId!, service: row.service!, host: row.host!, level: row.level!, message: row.message!, metadata: row.metadata!, created_at: row.timestamp! }), source_event_id: row.sourceEventId }
            await query(`INSERT INTO events(id,ingestion_id,organization_id,event_timestamp,event_type,action,outcome,normalized,processing_status)
                VALUES($1,'logs','platform',$2,$3,$4,$5,$6::jsonb,'pending')`,
            [eventIds([row])[0], row.timestamp, normalized.event_type, normalized.action, normalized.outcome, JSON.stringify(normalized)])
        }
        expect(await tx(q => analyzeRoutineGroupBatch(storedInput, q as any))).toEqual(storedInput)
        expect(await tx(q => analyzeRoutineGroupBatch(storedInput, q as any, { historicalReplay: { ruleId: 'unknown' } }))).toEqual(storedInput)
        expect(await tx(q => analyzeRoutineGroupBatch(storedInput, q as any, { historicalReplay: { ruleId: telemetryRuleId } }))).toEqual(replaySsh)
        const canonical = (await query('SELECT normalized->\'metadata\' AS metadata FROM events WHERE normalized->>\'service\'=\'routine-group-analyzer\' AND normalized->\'metadata\'->\'original_records\' @> $1::jsonb', [JSON.stringify([{ sourceEventId: replayTelemetry[0].sourceEventId }])])).rows
        expect(canonical).toHaveLength(1)
        expect(canonical[0].metadata.original_records).toEqual(replayTelemetry)
        // The analyzer never deletes originals; the replay transaction owns that.
        expect(await countEvents(storedInput)).toBe(7)
        await query('UPDATE rules SET definition=$2 WHERE rule_id=$1', [telemetryRuleId, JSON.stringify({ ...telemetryDefinition, conditions: [{ path: 'host', operator: 'equals', value: 'excluded' }] })])
        expect(await tx(q => analyzeRoutineGroupBatch(replayTelemetry, q as any, { historicalReplay: { ruleId: telemetryRuleId } }))).toEqual(replayTelemetry)
        const expired = replayTelemetry.map(row => ({ ...row, timestamp: new Date(Date.now() - 120000).toISOString() }))
        expect(await tx(q => analyzeRoutineGroupBatch(expired, q as any, { historicalReplay: { ruleId: telemetryRuleId } }))).toEqual(expired)
        await query('UPDATE rules SET enabled=false WHERE rule_id=$1', [telemetryRuleId])
        await install()
        expect((await query('SELECT enabled FROM rules WHERE rule_id=$1', [telemetryRuleId])).rows[0].enabled).toBe(false)
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
}, 20000)
