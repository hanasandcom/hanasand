import run, { closeDatabase, withTransaction } from '#db'

// Remove the old service_logs pointer without rewriting the entire events table
// in one transaction. CTID page ranges avoid sorting the full table for every
// batch and only visit each heap page once.
const pageBatchSize = Math.min(50_000, Math.max(1, Number(process.env.SERVICE_LOG_REFERENCE_BATCH_PAGES) || 5_000))
let total = 0
let batches = 0
try {
    const { rows: [size] } = await run(`SELECT (pg_relation_size('events') / current_setting('block_size')::int)::bigint AS pages`)
    const pageCount = Number(size?.pages || 0)
    if (!Number.isSafeInteger(pageCount) || pageCount < 0) throw new Error(`Invalid events heap page count: ${size?.pages}`)

    for (let startPage = 0; startPage < pageCount; startPage += pageBatchSize) {
        const endPage = Math.min(pageCount, startPage + pageBatchSize)
        const result = await withTransaction(async query => {
            await query("SET LOCAL lock_timeout = '2s'")
            await query("SET LOCAL statement_timeout = '90s'")
            const { rows: [batch] } = await query(`WITH updated AS (
                    UPDATE events
                    SET original=original-'service_log_id'
                    WHERE ctid >= ('(' || $1::text || ',0)')::tid
                      AND ctid < ('(' || $2::text || ',0)')::tid
                      AND original ? 'service_log_id'
                    RETURNING 1
                ) SELECT count(*)::int AS count FROM updated`, [startPage, endPage])
            return batch as { count: number }
        })
        total += result.count
        batches++
        console.log(JSON.stringify({ removed: total, batches, pages: `${endPage}/${pageCount}` }))
    }
    console.log(JSON.stringify({ complete: true, removed: total, batches }))
} finally {
    await closeDatabase()
}
