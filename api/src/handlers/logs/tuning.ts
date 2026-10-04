import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import hasHanasandInternalRouteAccess, { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPageAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { cachedLogQuery } from '#utils/logs/cache.ts'

const TUNING_CACHE_MS = 5 * 60_000
const TUNING_RESPONSE_WAIT_MS = 8_000

export async function getLogTuning(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    if (!(await hasHanasandInternalRouteAccess(req)).valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })

    try {
        const loading = cachedLogQuery('top-log-tuning', TUNING_CACHE_MS, queryLogTuning).then(
            data => ({ kind: 'ready' as const, data }),
            error => ({ kind: 'failed' as const, error }),
        )
        let timer: ReturnType<typeof setTimeout> | undefined
        const outcome = await Promise.race([
            loading,
            new Promise<{ kind: 'pending' }>(resolve => {
                timer = setTimeout(() => resolve({ kind: 'pending' }), TUNING_RESPONSE_WAIT_MS)
            }),
        ])
        if (timer) clearTimeout(timer)
        if (outcome.kind === 'pending') {
            return res.header('retry-after', '15').status(202).send({ pending: true })
        }
        if (outcome.kind === 'failed') throw outcome.error
        return res.send(outcome.data)
    } catch (error) {
        req.log?.error?.({ error }, 'Log tuning summary failed')
        return res.status(503).send({ error: 'Log tuning data is temporarily unavailable. Try again shortly.' })
    }
}

async function queryLogTuning() {
    const result = await withTransaction(async query => {
        // This all-time grouping scans the stored log history. The HTTP route
        // returns a pending response while the cache warms, so bound the DB
        // work separately from the short frontend proxy timeout.
        await query('SET LOCAL statement_timeout = \'180s\'')
        return query(`SELECT
                COALESCE(normalized->>'message', '') AS message,
                COALESCE(normalized->>'service', '') AS service,
                COALESCE(normalized->>'host', '') AS host,
                COALESCE(normalized->>'level', '') AS level,
                COALESCE(normalized->>'log_type', '') AS log_type,
                COALESCE(normalized->>'action', '') AS action,
                COALESCE(normalized->>'outcome', '') AS outcome,
                COALESCE(normalized->>'severity', '') AS severity,
                COUNT(*) FILTER (WHERE normalized->>'outcome' IN ('failure', 'failed', 'error', 'denied', 'blocked', 'timeout', 'timed_out')
                    OR CASE WHEN jsonb_typeof(normalized->'detections') = 'array' THEN jsonb_array_length(normalized->'detections') > 0 ELSE FALSE END)::text AS protected_event_count,
                COUNT(*)::text AS event_count,
                SUM(pg_column_size(event))::text AS storage_bytes
            FROM events event
            WHERE organization_id = $1
              AND ingestion_id = 'logs'
              AND processing_status = 'processed'
              AND normalized->>'message' IS NOT NULL
              AND normalized->>'message' <> ''
            GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
            ORDER BY COUNT(*) DESC, SUM(pg_column_size(event)) DESC, 1, 2
            LIMIT 100`, [HANASAND_ORGANIZATION_ID])
    })
    return {
        organizationId: HANASAND_ORGANIZATION_ID,
        generatedAt: new Date().toISOString(),
        logs: result.rows,
    }
}
