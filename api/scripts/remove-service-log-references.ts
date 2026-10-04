import run, { closeDatabase, withTransaction } from '#db'

// Remove the old service_logs pointer without rewriting the entire events table
// in one transaction. CTID page ranges avoid sorting the full table for every
// batch and only visit each heap page once.
const pageBatchSize = Math.min(50_000, Math.max(1, Number(process.env.SERVICE_LOG_REFERENCE_BATCH_PAGES) || 10_000))
let total = 0
let batches = 0
const deferredPages: number[] = []

async function processRange(startPage: number, endPage: number, attempt = 0): Promise<void> {
    try {
        const result = await withTransaction(async query => {
            await query("SET LOCAL lock_timeout = '2s'")
            await query("SET LOCAL statement_timeout = '300s'")
            const result = await query(`UPDATE events
                    SET original=original-'service_log_id'
                    WHERE ctid >= ('(' || $1::text || ',0)')::tid
                      AND ctid < ('(' || $2::text || ',0)')::tid
                      AND original ? 'service_log_id'`, [startPage, endPage])
            return { count: result.rowCount || 0 }
        })
        total += result.count
        batches++
        return
    } catch (error) {
        const code = (error as { code?: string }).code
        if (code !== '55P03' && code !== '57014') throw error
        if (endPage - startPage > 1) {
            const middlePage = startPage + Math.floor((endPage - startPage) / 2)
            await processRange(startPage, middlePage)
            await processRange(middlePage, endPage)
            return
        }
        if (attempt >= 3) {
            deferredPages.push(startPage)
            return
        }
        await Bun.sleep(1000 * (attempt + 1))
        await processRange(startPage, endPage, attempt + 1)
    }
}

try {
    const { rows: [size] } = await run(`SELECT (pg_relation_size('events') / current_setting('block_size')::int)::bigint AS pages`)
    const pageCount = Number(size?.pages || 0)
    if (!Number.isSafeInteger(pageCount) || pageCount < 0) throw new Error(`Invalid events heap page count: ${size?.pages}`)

    for (let startPage = 0; startPage < pageCount; startPage += pageBatchSize) {
        const endPage = Math.min(pageCount, startPage + pageBatchSize)
        await processRange(startPage, endPage)
        console.log(JSON.stringify({ removed: total, batches, pages: `${endPage}/${pageCount}` }))
    }
    for (let retry = 1; deferredPages.length && retry <= 12; retry++) {
        const pending = deferredPages.splice(0)
        console.log(JSON.stringify({ retry, deferredPages: pending.length, removed: total }))
        await Bun.sleep(5000)
        for (const page of pending) await processRange(page, page + 1)
    }
    if (deferredPages.length) throw new Error(`Could not update ${deferredPages.length} event heap pages after retries`)
    console.log(JSON.stringify({ complete: true, removed: total, batches }))
} finally {
    await closeDatabase()
}
