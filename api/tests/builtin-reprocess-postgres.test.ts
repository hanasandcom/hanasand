import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { fixture } from './analyze-ingestion.test.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('Event replay removes only proven copies and preserves canonical records, findings and disabled rules', async () => {
    const namespace = `builtin_replay_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.POSTGRES_FILTER_TEST_PORT), user: 'postgres', database: 'postgres_filter_test', options: `-c search_path=${namespace}` })
    let failDelete = false
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
    const identityQueryOnce = (sql: string, values?: unknown[]) => query(sql.replace('public.system_events', 'system_events'), values)
    const transaction = async (work: (tx: typeof query) => Promise<unknown>) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const result = await work((sql, values) => {
                if (failDelete && sql.startsWith('DELETE FROM events')) throw new Error('Test event deletion failure')
                return client.query(sql, values)
            })
            await client.query('COMMIT'); return result
        }
        catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    mock.module('#db', () => ({ default: query, identityQueryOnce, isTransientDatabaseError: () => false,
        withDatabaseAdvisoryLock: async (_key: string, work: (query: typeof query) => unknown) => work(query), withTransaction: transaction }))
    try {
        expect((await query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT \'{}\')')
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query('INSERT INTO organizations(id,name,status) VALUES(\'platform\',\'Hanasand\',\'active\')')
        const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
        for (const table of ['events', 'findings', 'rules', 'system_events']) {
            const ddl = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
            if (!ddl) throw new Error(`Missing schema ${table}`)
            await query(ddl)
        }
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { default: jobs } = await import('../src/utils/db/ruleReprocessSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        const { processRuleReprocessJob } = await import('../src/utils/events/ruleReprocess.ts')
        const { ingestionRuleId } = await import('../src/utils/events/analyzeIngestion.ts')
        await install(); await jobs()
        await query('UPDATE rules SET enabled=false WHERE rule_id=$1', [ingestionRuleId])
        const first = fixture()
        first.timestamp = new Date(Date.now() - 60000).toISOString()
        first.metadata.structured.time = Date.parse(first.timestamp)
        first.metadata.structured.access.timestamp = first.timestamp
        first.message = JSON.stringify(first.metadata.structured)
        const second = { ...structuredClone(first), sourceEventId: 'c'.repeat(64) }
        const warning = { ...structuredClone(first), sourceEventId: 'd'.repeat(64), level: 'warn' as const }
        await transaction(tx => recordLogBatch([first, second, warning], tx as any))
        const eventId = (entry: typeof first) => createHash('sha256').update(`service:${entry.sourceEventId}`).digest('hex')
        const countEvents = () => query('SELECT count(*) n FROM events WHERE id=ANY($1::text[])', [[eventId(first), eventId(second), eventId(warning)]])
        const enqueue = async (id: string) => query(`INSERT INTO rule_reprocess_jobs(id,organization_id,rule_id,rule_version,requested_by,until_time,cursor)
            SELECT $1,organization_id,rule_id,version,'test',NOW(),$3::jsonb FROM rules WHERE rule_id=$2`,
        [id, ingestionRuleId, JSON.stringify({ phase: 0 })])
        await enqueue('disabled')
        await processRuleReprocessJob()
        expect((await query('SELECT status FROM rule_reprocess_jobs WHERE id=\'disabled\'')).rows[0].status).toBe('cancelled')
        expect((await countEvents()).rows[0].n).toBe('3')
        await query('UPDATE rules SET enabled=true WHERE rule_id=$1', [ingestionRuleId])
        // Link one copy to an existing finding: neither raw nor indexed evidence may disappear.
        await query(`INSERT INTO findings(id,organization_id,finding_key,rule_id,severity,summary,event_ids)
            VALUES('finding','platform','finding','custom','high','Retain evidence',$1::text[])`, [[eventId(first)]])
        await enqueue('protected')
        await processRuleReprocessJob()
        expect((await countEvents()).rows[0].n).toBe('3')
        // Remove the test-only linkage, then retry the same saved rule through Event.
        await query('DELETE FROM findings WHERE id=\'finding\'')
        failDelete = true
        await enqueue('rollback')
        await processRuleReprocessJob()
        expect((await query('SELECT status FROM rule_reprocess_jobs WHERE id=\'rollback\'')).rows[0].status).toBe('failed')
        expect((await countEvents()).rows[0].n).toBe('3')
        failDelete = false
        await enqueue('drop')
        const liveWorker = await pool.connect()
        try {
            await liveWorker.query('BEGIN')
            await liveWorker.query('SELECT pg_advisory_xact_lock(hashtextextended(\'event:unrelated-legacy-lock\',0))')
            expect(await processRuleReprocessJob()).toBe(true)
            await liveWorker.query('COMMIT')
        } finally { await liveWorker.query('ROLLBACK'); liveWorker.release() }
        const job = (await query('SELECT * FROM rule_reprocess_jobs WHERE id=\'drop\'')).rows[0]
        expect(job.status).toBe('completed')
        expect(job.removed_sources).toBe('0')
        expect(job.removed_events).toBe('1')
        expect((await countEvents()).rows[0].n).toBe('2')
        expect((await query('SELECT original FROM log_ingestion_canonical')).rows[0].original.message).toBe(first.message)
        expect((await query('SELECT count(*) n FROM log_ingestion_copies')).rows[0].n).toBe('1')
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
})
