import { withDatabaseAdvisoryLock } from '#db'
import { logPhraseSearchExpression } from '../logs/searchText.ts'

const logSearchIndexNames = [
    'idx_logs_phrase_trgm', 'idx_logs_service_time', 'idx_logs_exact_message_time', 'idx_log_dimensions_service_time', 'idx_logs_realtime_page_time',
    'idx_events_log_http_error_summary', 'idx_events_ssh_key_usage',
] as const

// Match selective log filters and the complete deterministic newest-first order.
// The covering projection index counts matches without fetching wide event JSON.
export const logSearchIndexes = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_phrase_trgm ON events
        USING GIN ((${logPhraseSearchExpression}) gin_trgm_ops)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_service_time ON events
        ((normalized->>'service'), event_timestamp DESC, id DESC)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_exact_message_time ON events
        (organization_id, (normalized->>'message'), event_timestamp DESC, id DESC)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'
            AND octet_length(normalized->>'message') <= 2048`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_realtime_page_time ON events
        (event_timestamp DESC, id DESC)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'
            AND normalized->>'severity' IN ('high', 'critical')`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_log_http_error_summary ON events
        (event_timestamp DESC,
         (normalized->'metadata'->>'surface'),
         ((NULLIF(normalized->'metadata'->>'status_code', ''))::int),
         (normalized->'metadata'->>'error_code'),
         (normalized->'metadata'->>'path'),
         (normalized->'metadata'->>'user_agent'))
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'
            AND normalized->'metadata'->>'category' IN ('http_response_error', 'application_error')`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_ssh_key_usage ON events
        (organization_id,
         (substring(normalized->>'message' FROM '(SHA256:[A-Za-z0-9+/]{43})')),
         event_timestamp DESC)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'
            AND event_type = 'authentication' AND action = 'login' AND outcome = 'success'
            AND normalized->>'service' = 'sshd'
            AND normalized->>'host' IN ('inspur', 'ovhcloud')
            AND normalized->>'message' LIKE 'Accepted publickey for % ssh2: % SHA256:%'`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_dimensions_service_time ON log_dimensions
        (service, event_timestamp DESC) INCLUDE (organization_id, severity, log_type)`,
]

let backgroundBuild: Promise<void> | null = null

async function buildLogSearchIndexes() {
    // Concurrent index builds cannot run inside the schema transaction. Serialize
    // the build, but keep the API startup path independent of a large one-time
    // index build so health checks do not report the service as unavailable.
    await withDatabaseAdvisoryLock('event:log-search-indexes', async query => {
        const indexNames = [...logSearchIndexNames]
        const invalid = await query(`SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE c.relname = ANY($1::text[]) AND NOT i.indisvalid`, [indexNames])
        for (const row of invalid.rows) {
            const name = String(row.relname)
            if (logSearchIndexNames.includes(name as typeof logSearchIndexNames[number])) await query(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`)
        }
        for (const statement of logSearchIndexes) await query(statement)
        const remainingInvalid = await query(`SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE c.relname = ANY($1::text[])
              AND NOT i.indisvalid`, [indexNames])
        if (remainingInvalid.rows.length) throw new Error('Log search index build is incomplete: ' + remainingInvalid.rows.map(row => row.relname).join(', '))
    })
}

export default async function ensureLogSearchIndexes() {
    if (backgroundBuild) return
    backgroundBuild = buildLogSearchIndexes()
    void backgroundBuild.catch(error => {
        console.error('Log search index build failed; it will retry on the next API start.', error)
        backgroundBuild = null
    })
}
