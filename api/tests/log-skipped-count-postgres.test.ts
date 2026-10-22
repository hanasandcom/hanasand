import { expect, test } from 'bun:test'
import pg from 'pg'
import { closeDatabase, withTransaction } from '../src/utils/db.ts'
import { createSkippedCountReader } from '../src/utils/logs/skippedCount.ts'

const enabled = process.env.RUN_LOGS_TIMEOUT_STAGE === '1'
test.skipIf(!enabled)('real PostgreSQL cancels only the historical metric and retains event rows', async () => {
    const stageId = process.env.LOGS_TIMEOUT_STAGE_ID || ''
    if (!/^[a-f0-9]{12}$/.test(stageId) || process.env.DB_HOST !== `logs-timeout-stage-db-${stageId}`
        || (process.env.DB_POOL_HOST && process.env.DB_POOL_HOST !== process.env.DB_HOST) || process.env.DB !== 'logs_timeout_stage_test' || process.env.DB_USER !== 'synthetic') throw new Error('Requires isolated synthetic Logs timeout database')
    const application = `logs-timeout-fixture-${stageId}`
    const pool = new pg.Pool({ host: process.env.DB_HOST, port: 5432, database: process.env.DB, user: 'synthetic', password: process.env.DB_PASSWORD, max: 3, application_name: application })
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
    } finally { await pool.end(); await closeDatabase() }
}, 15_000)
