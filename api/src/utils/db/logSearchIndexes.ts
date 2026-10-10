import { withDatabaseAdvisoryLock } from '#db'

const logSearchIndexNames = [
    'idx_logs_exact_message_time',
    'idx_log_dimensions_org_time',
] as const

// Keep recent dashboard aggregates on indexed time ranges instead of scanning
// all processed log dimensions on every cache refresh.
export const logSearchIndexes = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_dimensions_org_time ON log_dimensions
        (organization_id, event_timestamp)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_exact_message_time ON events
        (organization_id, (normalized->>'message'), event_timestamp DESC, id DESC)
        WHERE ingestion_id = 'logs' AND processing_status = 'processed'
            AND octet_length(normalized->>'message') <= 2048`,
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
