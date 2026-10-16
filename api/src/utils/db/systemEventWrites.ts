import run from '#db'
import type { IdentityQuery } from './identityQueryTypes.ts'

export async function upsertSystemEventAcknowledgment(eventId: number, userId: string, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE system_event_acknowledgments
           SET acknowledged_by = $2, acknowledged_at = NOW()
         WHERE event_id = $1
        RETURNING acknowledged_at, acknowledged_by
    `, [eventId, userId])
    const updated = await update()
    if (updated.rowCount) return updated.rows[0]
    try {
        const inserted = await query(`
            INSERT INTO system_event_acknowledgments (event_id, acknowledged_by)
            SELECT id, $2 FROM system_events WHERE id = $1
            RETURNING acknowledged_at, acknowledged_by
        `, [eventId, userId])
        return inserted.rows[0] ?? null
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (retried.rowCount) return retried.rows[0]
        return null
    }
}
