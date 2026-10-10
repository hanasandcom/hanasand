import { withTransaction } from '#db'

export type LogSource = 'login_events' | 'traffic_events' | 'system_events'

// Read the current source boundary only when no source transaction is active.
// The try-lock avoids waiting behind an in-flight insert that may have allocated
// a lower sequence ID but has not committed yet.
export async function stableLogWatermark(source: LogSource): Promise<string | null> {
    try {
        return await withTransaction(async query => {
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired', [`logs:watermark:${source}`])
            if (!lock.rows[0]?.acquired) return null
            const result = await query(`SELECT COALESCE(MAX(id), 0)::text AS last_id FROM ${source}`)
            return String(result.rows[0].last_id)
        })
    } catch (error) {
        if ((error as { code?: string }).code === '55P03') return null
        throw error
    }
}
