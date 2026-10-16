import { installEnsureSchemaTables } from './support/ensureSchemaTables.ts'
import { expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { fixture } from './analyze-postgres-fixtures.ts'
import { postgresRuleId, postgresDefinition } from '../src/utils/events/analyzePostgres.ts'
import { normalizeLogEvent } from '../src/utils/events/logEvent.ts'

// Opt-in disposable local cluster; this test never accepts a remote host/database.
test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('real transactions preserve evidence, retries, rollback and Keep', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Disposable local test port required')
    const namespace = `postgres_filter_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ options: `-c search_path=${namespace}`, host: '127.0.0.1', port, database: 'postgres_filter_test', max: 4 })
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
    const transaction = async (work: (tx: typeof query) => Promise<unknown>) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const result = await work((sql, values) => client.query(sql, values))
            await client.query('COMMIT')
            return result
        } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    const eventIdForSource = (sourceEventId: string) => createHash('sha256').update(`service:${sourceEventId}`).digest('hex')
    const storedSources = (sourceEventIds: string[]) => query(`SELECT * FROM events
        WHERE ingestion_id='logs' AND normalized->>'source_event_id'=ANY($1::text[])`, [sourceEventIds])
    const deleteStoredSources = (sourceEventIds: string[]) => query(`DELETE FROM events
        WHERE ingestion_id='logs' AND normalized->>'source_event_id'=ANY($1::text[])`, [sourceEventIds])
    mock.module('#db', () => ({ default: query, queryOnce: query,
        identityQueryOnce: (sql: string, values?: unknown[]) => query(sql.replace('public.system_events', 'system_events'), values),
        isTransientDatabaseError: () => false,
        withTransaction: transaction, withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work() }))
    mock.module('#constants', () => ({ default: {} }))
    try {
        expect((await query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query('CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT \'{}\')')
        await query('INSERT INTO organizations(id,name,status) VALUES(\'platform\',\'Hanasand\',\'active\')')
        await installEnsureSchemaTables(import.meta.url, query, ['rules', 'system_events', 'events', 'findings'])
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        await install()
        const logs = fixture().map(row => ({ ...row, level: 'info' as const }))
        await Promise.all([1, 2].map(() => transaction(tx => recordLogBatch(logs, tx as any))))
        let stored = await query('SELECT * FROM events WHERE ingestion_id=\'logs\'')
        expect(stored.rows).toHaveLength(1)
        expect(stored.rows[0].normalized.metadata.lifecycle_records).toEqual(logs)
        const { processLogBatch } = await import('../src/utils/events/processLogs.ts')
        const { createFindings, normalizeEvent } = await import('../src/handlers/events.ts')
        const detector = { id: 'fixture.postgres-original', version: '1', name: 'Original PostgreSQL service', severity: 'high', family: 'Database',
            explanation: 'Verify originals still reach detection', evidence: [], enabled: true, source: 'owned' as const,
            definition: { match: 'all' as const, stage: 'detect' as const, conditions: [{ path: 'service', operator: 'equals' as const, value: 'hanasand_database' }] } }
        await processLogBatch(stored.rows.map(row => ({
            id: row.id,
            eventId: row.id,
            service: row.normalized.service,
            host: row.normalized.host,
            level: row.normalized.level,
            message: row.normalized.message,
            metadata: row.normalized.metadata,
            created_at: row.normalized.timestamp,
            source_event_id: row.normalized.source_event_id,
        })), 'platform', [detector])
        const event = (await query('SELECT * FROM events')).rows[0]
        expect(event.normalized.severity).toBe('high')
        expect(event.normalized.detections[0].rule_id).toBe(detector.id)
        const finding = (await query('SELECT * FROM findings')).rows[0]
        expect(finding.event_ids).toEqual([event.id])
        expect(finding.evidence.retainedOriginals).toHaveLength(3)
        expect(finding.evidence.retainedOriginals.map((row: any) => row.message)).toEqual(logs.map(row => row.message))
        // A detector added later must also match during manual replay of the
        // canonical event, which does not pass through processLogBatch again.
        await createFindings('platform', event.id, normalizeEvent(event.normalized, {}), [{ ...detector, id: 'fixture.postgres-replay' }])
        expect((await query('SELECT count(*) FROM findings WHERE rule_id=\'fixture.postgres-replay\'')).rows[0].count).toBe('1')
        expect((await query('SELECT dropped_records,retained_sessions FROM log_postgres_session_state')).rows[0]).toEqual({ dropped_records: '3', retained_sessions: '1' })
        await transaction(tx => recordLogBatch(logs.slice(0, 1), tx as any))
        expect((await storedSources([logs[0].sourceEventId!])).rows).toHaveLength(1)
        await deleteStoredSources([logs[0].sourceEventId!])
        await query('UPDATE log_postgres_session_state SET recent=\'[]\'')
        const next = fixture().map(row => ({ ...row, level: 'info' as const, sourceEventId: row.sourceEventId!.replace(/1/g, 'a').replace(/2/g, 'b').replace(/3/g, 'c'), message: row.message.replace('[123]', '[456]') }))
        await expect(transaction(async tx => { await recordLogBatch(next, tx as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect((await query('SELECT count(*) FROM events WHERE ingestion_id=\'logs\'')).rows[0].count).toBe('1')
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe('3')
        await query('UPDATE rules SET definition=jsonb_set(definition,\'{action}\',\'"keep"\') WHERE rule_id=$1', [postgresRuleId])
        await install()
        await transaction(tx => recordLogBatch(next, tx as any))
        stored = await query('SELECT * FROM events WHERE ingestion_id=\'logs\'')
        expect(stored.rows).toHaveLength(4)
        expect((await query('SELECT dropped_records FROM log_postgres_session_state')).rows[0].dropped_records).toBe('3')
        const failed = { ...next[0], sourceEventId: 'f'.repeat(64), level: 'error' as const, message: next[0].message.replace('LOG:  connection received: host=[local]', 'FATAL:  password authentication failed') }
        await transaction(tx => recordLogBatch([failed], tx as any))
        expect((await storedSources([failed.sourceEventId!])).rows[0].normalized.message).toBe(failed.message)
        await query('UPDATE rules SET definition=jsonb_set(definition,\'{action}\',\'"drop"\') WHERE rule_id=$1', [postgresRuleId])
        await query(`INSERT INTO rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('protect-pg','platform','fixture-protect-pg','1','Investigate local probes','Database','high','Fixture detector',$1::jsonb,'owned',TRUE)`, [JSON.stringify(detector.definition)])
        const protectedLogs = fixture().map((row, index) => ({ ...row, level: 'info' as const,
            sourceEventId: String(7 + index).repeat(64), message: row.message.replace('[123]', '[789]') }))
        await transaction(tx => recordLogBatch(protectedLogs, tx as any))
        expect((await storedSources(protectedLogs.map(log => log.sourceEventId!))).rows).toHaveLength(3)
        expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe('3')
        await query('DELETE FROM rules WHERE id=\'protect-pg\'')
        for (const definition of [
            {...postgresDefinition,conditions:[{path:'host',operator:'equals',value:'other'}]},
            {...postgresDefinition,conditions:[{path:'postgres_session.application',operator:'equals',value:'psql'}]},
            {...postgresDefinition,parameters:{...postgresDefinition.parameters,maxDurationMs:1}},
            {...postgresDefinition,parameters:{...postgresDefinition.parameters,maxAgeMs:1}},
            {...postgresDefinition,parameters:{}},
        ]) {
            await query('UPDATE rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify(definition)])
            await deleteStoredSources(logs.map(log=>log.sourceEventId!))
            await transaction(tx=>recordLogBatch(logs,tx as any))
            expect((await storedSources(logs.map(log=>log.sourceEventId!))).rows).toHaveLength(3)
            expect((await query('SELECT count(*) FROM log_analyze_receipts')).rows[0].count).toBe('3')
        }
        const { analyzePostgresBatch } = await import('../src/utils/events/analyzePostgresBatch.ts')
        await query('UPDATE rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify(postgresDefinition)])
        await query('UPDATE log_postgres_session_state SET recent=\'[]\'')
        const historical = fixture().map((row,index)=>({...row,level:'info' as const,sourceEventId:String(index+4).repeat(64),message:row.message.replace('[123]','[654]')}))
        for (const row of historical) {
            const normalized = { ...normalizeLogEvent({
                id: row.sourceEventId!, service: row.service!, host: row.host!, level: row.level, message: row.message,
                metadata: row.metadata, created_at: row.timestamp!,
            }), source_event_id: row.sourceEventId }
            await query(`INSERT INTO events(id,ingestion_id,organization_id,event_timestamp,event_type,action,outcome,normalized)
                VALUES($1,'logs','platform',$2,$3,$4,$5,$6::jsonb)`, [eventIdForSource(row.sourceEventId!), row.timestamp,
                normalized.event_type, normalized.action, normalized.outcome, JSON.stringify(normalized)])
        }
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any))).toEqual(historical)
        expect(await transaction(tx=>analyzePostgresBatch(historical.slice(1),tx as any,{historicalReplay:true}))).toEqual(historical.slice(1))
        await query('UPDATE rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify({...postgresDefinition,parameters:{...postgresDefinition.parameters,maxDurationMs:1}})])
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any,{historicalReplay:true}))).toEqual(historical)
        await query('UPDATE rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify({...postgresDefinition,action:'keep'})])
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any,{historicalReplay:true}))).toEqual(historical)
        await query('UPDATE rules SET definition=$2::jsonb WHERE rule_id=$1',[postgresRuleId,JSON.stringify(postgresDefinition)])
        await query(`INSERT INTO rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
            VALUES('historical-protect','platform','historical-protect','1','Protect historical','Database','high','Fixture detector',$1::jsonb,'owned',TRUE)`,[JSON.stringify(detector.definition)])
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any,{historicalReplay:true}))).toEqual(historical)
        await query('DELETE FROM rules WHERE id=\'historical-protect\'')
        expect(await transaction(tx=>analyzePostgresBatch(historical,tx as any,{historicalReplay:true}))).toEqual([])
        const historicalSummary = (await query(`SELECT id,normalized FROM events WHERE ingestion_id='logs'
            AND normalized->>'service'='postgres-session-analyzer' AND normalized->'metadata'->>'backend_pid'='654'`)).rows[0]
        expect(historicalSummary.normalized.metadata.lifecycle_records).toEqual(historical)
        // The caller owns deletion after this transaction's canonical evidence is ready.
        expect((await storedSources(historical.map(row=>row.sourceEventId!))).rows).toHaveLength(3)
        await deleteStoredSources(historical.map(row=>row.sourceEventId!))
        const retainedEvent = (await query('SELECT * FROM events WHERE id=$1', [event.id])).rows[0]
        expect(retainedEvent.normalized.metadata.lifecycle_records).toEqual(logs)
        await createFindings('platform', event.id, normalizeEvent(retainedEvent.normalized, {}), [{ ...detector, id: 'fixture.after-raw-retention' }])
        expect((await query('SELECT count(*) FROM findings WHERE rule_id=\'fixture.after-raw-retention\'')).rows[0].count).toBe('1')
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
}, 15000)
