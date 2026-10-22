import { isTransientDatabaseError, withTransaction } from '#db'

export type SkippedLogCount = {
    skipped_events: number | null
    skipped_events_available: boolean
    skipped_events_checked_at: string
    skipped_events_warning?: string
}

// A historical counter must not abort indexed event rows or leave an abandoned
// full-table scan running. PostgreSQL cancels it inside its own transaction.
export function createSkippedCountReader(transaction = withTransaction, now = Date.now) {
    let snapshot: SkippedLogCount | undefined
    let pending: Promise<SkippedLogCount> | undefined
    return function read(): Promise<SkippedLogCount> {
        if (snapshot && now() - Date.parse(snapshot.skipped_events_checked_at) < 30_000) return Promise.resolve(snapshot)
        if (!pending) {
            pending = (async () => {
                let count: number | null
                try {
                    count = await transaction(async query => {
                        await query('SET LOCAL statement_timeout = \'750ms\'')
                        const value = (await query('SELECT COUNT(*)::int AS count FROM events WHERE ingestion_id = \'logs\' AND processing_status = \'skipped\' /* log-skipped-count */')).rows[0]?.count
                        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid excluded log count response.')
                        return value as number
                    })
                } catch (error) {
                    const code = (error as { code?: string }).code
                    if (code !== '57014' && code !== 'DB_QUEUE_FULL' && !isTransientDatabaseError(error)) throw error
                    count = null
                }
                snapshot = { skipped_events: count, skipped_events_available: count !== null, skipped_events_checked_at: new Date(now()).toISOString(),
                    ...(count === null ? { skipped_events_warning: 'The historical excluded event count is temporarily unavailable. Recent events and processing status are still available.' } : {}) }
                return snapshot
            })().finally(() => { pending = undefined })
        }
        return pending
    }
}

export const readSkippedLogCount = createSkippedCountReader()
