import { expect, test, mock } from 'bun:test'
import pg from 'pg'
import { closeDatabase, withTransaction } from '../src/utils/db.ts'
import { createErrorSummaryReader } from '../src/handlers/logs/errorSummary.ts'
import Fastify from 'fastify'
import { createSkippedCountReader } from '../src/utils/logs/skippedCount.ts'

const enabled = process.env.RUN_LOGS_TIMEOUT_STAGE === '1'
test.skipIf(!enabled)('real PostgreSQL cancels only the historical metric and retains event rows', async () => {
    const stageId = process.env.LOGS_TIMEOUT_STAGE_ID || ''
    if (!/^[a-f0-9]{12}$/.test(stageId) || process.env.DB_HOST !== `logs-timeout-stage-db-${stageId}`
        || (process.env.DB_POOL_HOST && process.env.DB_POOL_HOST !== process.env.DB_HOST) || process.env.DB !== 'logs_timeout_stage_test' || process.env.DB_USER !== 'synthetic') throw new Error('Requires isolated synthetic Logs timeout database')
    const application = `logs-timeout-fixture-${stageId}`
    const pool = new pg.Pool({ host: process.env.DB_HOST, port: 5432, database: process.env.DB, user: 'synthetic', password: process.env.DB_PASSWORD, max: 3, application_name: application })
    const app = Fastify({ logger: false })
    let now = Date.now()
    let failureCode: string | undefined
    const transaction: typeof withTransaction = (work, options) => withTransaction(async query => {
        try { return await work(query) }
        catch (error) { failureCode = (error as { code?: string }).code; throw error }
    }, options)
    try {
        await pool.query('CREATE TABLE stage_events(id text PRIMARY KEY, ingestion_id text NOT NULL, processing_status text NOT NULL)')
        await pool.query(`INSERT INTO stage_events VALUES
            ('recent-1','logs','processed'),('recent-2','logs','processed'),
            ('skipped-1','logs','skipped'),('skipped-2','logs','skipped'),('skipped-3','logs','skipped'),
            ('other-source','other','skipped'),('pending','logs','pending')`)
        // A synthetic view makes only excluded rows expensive. Use the real
        // application transaction implementation and real PostgreSQL timeout.
        await pool.query(`CREATE VIEW events AS SELECT e.* FROM stage_events e
            CROSS JOIN LATERAL pg_sleep(CASE WHEN e.processing_status='skipped' THEN 3 ELSE 0 END) delay`)
        const read = createSkippedCountReader(transaction, () => now)
        const begin = Date.now()
        const pending = read()
        const main = await pool.query('SELECT id FROM events WHERE ingestion_id=\'logs\' AND processing_status=\'processed\' ORDER BY id')
        expect(main.rows.map(row => row.id)).toEqual(['recent-1', 'recent-2'])
        const metric = await pending
        expect(Date.now() - begin).toBeLessThan(3000)
        expect(failureCode).toBe('57014')
        expect(metric.skipped_events).toBeNull()
        expect(metric.skipped_events_available).toBe(false)
        expect(metric.skipped_events_warning).toContain('temporarily unavailable')
        expect({ rows: main.rows, processing: metric }.rows).toHaveLength(2)
        const active = await pool.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND state=\'active\' AND query LIKE \'%log-skipped-count%\'')
        expect(active.rows[0].count).toBe(0)
        expect((await pool.query('SELECT 42 AS answer')).rows[0].answer).toBe(42)
        expect((await withTransaction(query => query('SHOW statement_timeout'))).rows[0].statement_timeout).toBe('0')
        expect(await read()).toBe(metric)
        await pool.query('CREATE OR REPLACE VIEW events AS SELECT * FROM stage_events')
        now += 30_001
        const recovered = await read()
        expect(recovered.skipped_events).toBe(3)
        expect(recovered.skipped_events_available).toBe(true)
        expect(recovered.skipped_events_checked_at).not.toBe(metric.skipped_events_checked_at)
        expect(recovered.skipped_events_warning).toBeUndefined()
        await pool.query('DROP VIEW events')
        await expect(createSkippedCountReader()()).rejects.toMatchObject({ code: '42P01' })
        await pool.query(`ALTER TABLE stage_events ADD COLUMN normalized JSONB NOT NULL DEFAULT '{}',
            ADD COLUMN event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();
            CREATE TABLE login_events(id BIGSERIAL PRIMARY KEY,user_id TEXT,status TEXT,reason TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
            CREATE TABLE traffic_events(id BIGSERIAL PRIMARY KEY,method TEXT,path TEXT,status INT,user_agent TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
            UPDATE stage_events SET normalized='{"service":"synthetic","level":"error","message":"Synthetic error", "metadata":{"category":"application_error","status_code":"500","error_code":"synthetic-failure","path":"/synthetic-visible"}}'
            WHERE processing_status='processed';
            CREATE VIEW events AS SELECT * FROM stage_events WHERE CASE
                WHEN current_setting('stage.slow_error_summary',true)='on' THEN pg_sleep(3) IS NOT NULL ELSE TRUE END`)
        let slowSummary = true, summaryFailure: string | undefined
        const summaryTransaction: typeof withTransaction = (work, options) => withTransaction(async query => {
            await query(`SET LOCAL stage.slow_error_summary = '${slowSummary ? 'on' : 'off'}'`)
            try { return await work(query) }
            catch (error) { summaryFailure = (error as { code?: string }).code; throw error }
        }, options)
        const readSummary = createErrorSummaryReader(summaryTransaction, () => now)
        // Authentication/proof replay are staged separately. This fixture verifies
        // the actual HTTP handler, real recent-row SQL and bounded summary SQL.
        mock.module('../src/handlers/logs/access.ts', () => ({ requireLogAccess: async () => true }))
        mock.module('../src/handlers/logs/errorSummary.ts', () => ({ loadErrorSummary: readSummary }))
        const { getErrorEvents } = await import('../src/handlers/logs/errors.ts')
        app.get('/api/logs/errors', getErrorEvents)
        const address = await app.listen({ host: '127.0.0.1', port: 0 })
        const response = await fetch(`${address}/api/logs/errors?limit=150`)
        const body = await response.json()
        expect(response.status).toBe(200)
        expect(summaryFailure).toBe('57014')
        expect(body.errors).toHaveLength(2)
        expect(body.errors.map((row: { path: string }) => row.path)).toEqual(['/synthetic-visible', '/synthetic-visible'])
        expect(body.summary).toBeNull()
        expect(body.summary_available).toBe(false)
        expect(body.warnings[0]).toContain('Recent error records are still available')
        expect(typeof body.summary_checked_at).toBe('string')
        expect((await pool.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND state=\'active\' AND query LIKE \'%WITH raw_events%\'')).rows[0].count).toBe(0)
        slowSummary = false
        now += 30_001
        const recoveredSummary = await readSummary(false)
        expect(recoveredSummary.summary_available).toBe(true)
        expect(recoveredSummary.summary?.total).toBe(2)
        expect(recoveredSummary.summary?.server_errors).toBe(2)
        expect(recoveredSummary.summary_checked_at).not.toBe(body.summary_checked_at)

    } finally { await app.close(); await pool.end(); await closeDatabase() }
}, 15_000)
