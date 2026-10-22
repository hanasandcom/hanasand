import { isTransientDatabaseError, withReadDatabase, withTransaction } from '#db'

export type ImmutableLogCount = {
    value: number | null
    available: boolean
    reason?: 'timeout' | 'temporarily_unavailable'
}

// This is an optional display metric, never an input to retention or deletion.
// Keep its exact metadata ownership predicate; row organization_id is not a
// substitute for historical metadata ownership. Cancel slow SQL on PostgreSQL.
export async function readImmutableOrganizationLogCount(organizationId: string): Promise<ImmutableLogCount> {
    try {
        const value = await withReadDatabase(() => withTransaction(async query => {
            await query('SET TRANSACTION READ ONLY')
            await query('SET LOCAL statement_timeout = \'750ms\'')
            await query('SET LOCAL lock_timeout = \'100ms\'')
            await query('SET LOCAL max_parallel_workers_per_gather = 0')
            const result = await query(`SELECT COUNT(*)::int AS immutable_log_events
                FROM events WHERE ingestion_id='logs'
                  AND (normalized #>> '{metadata,organizationId}' = $1
                    OR normalized #>> '{metadata,tenantId}' = $1)`, [organizationId])
            const count = result.rows[0]?.immutable_log_events
            if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
                throw new Error('The immutable organization log count was invalid.')
            }
            return count
        }))
        return { value, available: true }
    } catch (error) {
        const code = (error as { code?: string })?.code
        if (code === '57014' || code === '55P03') return { value: null, available: false, reason: 'timeout' }
        if (code === 'DB_QUEUE_FULL' || isTransientDatabaseError(error)) return { value: null, available: false, reason: 'temporarily_unavailable' }
        throw error
    }
}
