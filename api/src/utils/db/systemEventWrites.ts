import run from '#db'
import type { IdentityQuery } from './identityQueryTypes.ts'
import { updateThenInsert } from './updateThenInsert.ts'

export async function upsertSystemEventAcknowledgment(eventId: number, userId: string, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE system_event_acknowledgments
           SET acknowledged_by = $2, acknowledged_at = NOW()
         WHERE event_id = $1
        RETURNING acknowledged_at, acknowledged_by
    `, [eventId, userId])
    const result = await updateThenInsert(update, () => query(`
            INSERT INTO system_event_acknowledgments (event_id, acknowledged_by)
            SELECT id, $2 FROM system_events WHERE id = $1
            RETURNING acknowledged_at, acknowledged_by
        `, [eventId, userId]), 'return')
    return result.rows[0] ?? null
}
