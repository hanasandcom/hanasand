import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { tryWithDatabaseAdvisoryLock, withTransaction } from '#db'
import hasHanasandInternalRouteAccess, { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPageAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

const REFRESH_INTERVAL_MS = 60 * 60_000
const REFRESH_CHECK_INTERVAL_MS = 5 * 60_000

type TuningLog = {
    message: string
    ip: string
    ip_path: string | null
    user_agent: string
    user_agent_path: string | null
    protected_event_count: string
    event_count: string
    storage_bytes: string
}

type TuningSnapshot = {
    organizationId: string
    generatedAt: string | null
    logs: TuningLog[]
    pending: boolean
    refreshing: boolean
}

let refreshInFlight: Promise<unknown> | undefined

export async function getLogTuning(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    if (!(await hasHanasandInternalRouteAccess(req)).valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })

    try {
        const result = await run(`SELECT generated_at::text AS generated_at, logs,
                (generated_at IS NULL OR refresh_requested_at > generated_at) AS refreshing
            FROM log_tuning_snapshots WHERE organization_id = $1`, [HANASAND_ORGANIZATION_ID])
        const row = result.rows[0]
        const generatedAt = row?.generated_at ? new Date(row.generated_at).toISOString() : null
        return res.send({
            organizationId: HANASAND_ORGANIZATION_ID,
            generatedAt,
            logs: Array.isArray(row?.logs) ? row.logs : [],
            pending: !generatedAt,
            refreshing: Boolean(row?.refreshing),
        } satisfies TuningSnapshot)
    } catch (error) {
        req.log?.error?.({ error }, 'Log tuning snapshot read failed')
        return res.status(503).send({ error: 'Log tuning data is temporarily unavailable. Try again shortly.' })
    }
}

export async function postLogTuningRefresh(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    if (!(await hasHanasandInternalRouteAccess(req)).valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })

    try {
        await run(`INSERT INTO log_tuning_snapshots (organization_id, logs, refresh_requested_at)
            VALUES ($1, '[]'::jsonb, NOW())
            ON CONFLICT (organization_id) DO UPDATE SET refresh_requested_at = NOW()`, [HANASAND_ORGANIZATION_ID])
        void refreshLogTuningSnapshot().catch(error => req.log?.warn?.({ error }, 'Log tuning background refresh failed'))
        return res.header('retry-after', '15').status(202).send({ refreshing: true })
    } catch (error) {
        req.log?.error?.({ error }, 'Log tuning refresh could not be queued')
        return res.status(503).send({ error: 'Log tuning refresh could not be queued. Try again shortly.' })
    }
}

export function startLogTuningSnapshotRefresh(logger: { warn: (context: { error: unknown }, message: string) => void }) {
    const refreshIfDue = () => {
        void refreshLogTuningSnapshot().catch(error => logger.warn({ error }, 'Log tuning snapshot refresh failed'))
    }
    refreshIfDue()
    const timer = setInterval(refreshIfDue, REFRESH_CHECK_INTERVAL_MS)
    timer.unref()
    return () => clearInterval(timer)
}

function refreshLogTuningSnapshot() {
    if (refreshInFlight) return refreshInFlight
    refreshInFlight = tryWithDatabaseAdvisoryLock('log-tuning-snapshot-refresh', async() => {
        const existing = (await run(`SELECT generated_at::text AS generated_at, refresh_requested_at::text AS refresh_requested_at
            FROM log_tuning_snapshots WHERE organization_id = $1`, [HANASAND_ORGANIZATION_ID])).rows[0]
        const generatedAt = existing?.generated_at ? Date.parse(existing.generated_at) : 0
        const requestedAt = existing?.refresh_requested_at ? Date.parse(existing.refresh_requested_at) : 0
        if (generatedAt && requestedAt <= generatedAt && Date.now() - generatedAt < REFRESH_INTERVAL_MS) return 'current'

        const startedAt = new Date().toISOString()
        const result = await queryLogTuning()
        await run(`INSERT INTO log_tuning_snapshots (organization_id, logs, generated_at, refresh_requested_at)
            VALUES ($1, $2::jsonb, $3::timestamptz, $3::timestamptz)
            ON CONFLICT (organization_id) DO UPDATE SET logs = EXCLUDED.logs, generated_at = EXCLUDED.generated_at,
                refresh_requested_at = GREATEST(log_tuning_snapshots.refresh_requested_at, EXCLUDED.refresh_requested_at)`,
        [HANASAND_ORGANIZATION_ID, JSON.stringify(result), startedAt])
        return 'refreshed'
    }).finally(() => { refreshInFlight = undefined })
    return refreshInFlight
}

async function queryLogTuning(): Promise<TuningLog[]> {
    return withTransaction(async query => {
        // This all-time aggregation can take several minutes. It runs in a
        // background worker and never holds open the page's HTTP request.
        await query('SET LOCAL statement_timeout = \'15min\'')
        // Keep the full-history refresh from consuming unbounded disk space.
        await query('SET LOCAL temp_file_limit = \'20GB\'')
        await query('SET LOCAL max_parallel_workers_per_gather = 0')
        // Keep this high-cardinality hash aggregate in memory instead of spilling.
        await query('SET LOCAL work_mem = \'64GB\'')
        await query('SET LOCAL enable_sort = off')
        const result = await query(`SELECT
                COALESCE(normalized->>'message', '') AS message,
                COALESCE(NULLIF(normalized->>'ip', ''), NULLIF(normalized #>> '{source,ip}', ''), '') AS ip,
                CASE WHEN NULLIF(normalized->>'ip', '') IS NOT NULL THEN 'ip'
                    WHEN NULLIF(normalized #>> '{source,ip}', '') IS NOT NULL THEN 'source.ip' END AS ip_path,
                COALESCE(NULLIF(normalized->>'user_agent', ''), NULLIF(normalized #>> '{metadata,user_agent}', ''), '') AS user_agent,
                CASE WHEN NULLIF(normalized->>'user_agent', '') IS NOT NULL THEN 'user_agent'
                    WHEN NULLIF(normalized #>> '{metadata,user_agent}', '') IS NOT NULL THEN 'metadata.user_agent' END AS user_agent_path,
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
            GROUP BY 1, 2, 3, 4, 5
            ORDER BY COUNT(*) DESC, SUM(pg_column_size(event)) DESC, 1, 2, 4
            LIMIT 100`, [HANASAND_ORGANIZATION_ID])
        return result.rows as TuningLog[]
    })
}
