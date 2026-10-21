import run from '#db'
import { ensureColumn, ensureIndex } from './existingSchema.ts'
import ensureLogCatchupSchema from './logCatchupSchema.ts'
import ensureLogDimensionsSchema from './logDimensionsSchema.ts'
import ensureLogTuningSchema from './logTuningSchema.ts'

export default async function ensureEventLogSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                ingestion_id TEXT NOT NULL,
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                source_vendor TEXT NOT NULL DEFAULT 'custom',
                source_product TEXT NOT NULL DEFAULT 'generic-json',
                event_timestamp TIMESTAMPTZ NOT NULL,
                received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                event_type TEXT NOT NULL DEFAULT 'unknown',
                action TEXT NOT NULL DEFAULT 'unknown',
                outcome TEXT NOT NULL DEFAULT 'unknown',
                user_id TEXT,
                user_email TEXT,
                source_ip TEXT,
                source_country TEXT,
                source_city TEXT,
                device_id TEXT,
                normalized JSONB NOT NULL DEFAULT '{}'::jsonb,
                original JSONB NOT NULL DEFAULT '{}'::jsonb,
                parser_version TEXT NOT NULL DEFAULT 'event.v1',
                processing_status TEXT NOT NULL DEFAULT 'processed'
            )
        `)
    await ensureColumn(run, 'events', 'parser_version', 'ALTER TABLE events ADD COLUMN IF NOT EXISTS parser_version TEXT NOT NULL DEFAULT \'event.v1\'')
    await ensureRecoverableIndex('idx_events_logs_time', `CREATE INDEX IF NOT EXISTS idx_events_logs_time ON events(event_timestamp DESC, id DESC)
            WHERE ingestion_id = 'logs' AND processing_status = 'processed'`)
    await run('CREATE TABLE IF NOT EXISTS log_processing_cursors (name TEXT PRIMARY KEY, last_id BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_error TEXT)')
    await run('DROP TABLE IF EXISTS log_process_queue')
    await run('DROP TABLE IF EXISTS log_proxy_requests')
    await run('DROP TABLE IF EXISTS service_logs')
    await run('DROP FUNCTION IF EXISTS enqueue_process_logs()')
    await run('DELETE FROM log_processing_cursors WHERE name IN (\'service_logs\', \'process_logs_recovery\')')
    await ensureColumn(run, 'log_processing_cursors', 'recent_id', 'ALTER TABLE log_processing_cursors ADD COLUMN IF NOT EXISTS recent_id BIGINT')
    await ensureLogCatchupSchema()
    await ensureLogDimensionsSchema()
    await ensureLogTuningSchema()
}

async function ensureRecoverableIndex(indexName: string, statement: string) {
    const existing = (await run('SELECT indisvalid,indisready FROM pg_index WHERE indexrelid=to_regclass($1)', [indexName])).rows[0]
    if (existing && (!existing.indisvalid || !existing.indisready)) {
        await run(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`)
    }
    await ensureIndex(run, indexName, statement)
}
