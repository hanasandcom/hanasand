import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { isDatabaseLowLoad, tryWithDatabaseAdvisoryLock, withTransaction } from '#db'
import hasHanasandInternalRouteAccess, { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPageAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { cachedRead, invalidateReadCache } from '../../utils/readCache.ts'

const REFRESH_INTERVAL_MS = 60_000
const REFRESH_CHECK_INTERVAL_MS = 15_000
const TUNING_SNAPSHOT_CACHE_KEY = `log-tuning-snapshot:${HANASAND_ORGANIZATION_ID}`

type TuningLog = {
    message: string
    ip: string
    ip_path: string | null
    user_agent: string
    user_agent_path: string | null
    last_triggered: string | null
    last_24h_count: string
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
        const snapshot = await cachedRead<TuningSnapshot>(TUNING_SNAPSHOT_CACHE_KEY, 10_000, async() => {
            const result = await run(`SELECT generated_at::text AS generated_at, logs,
                    (generated_at IS NULL OR refresh_requested_at > generated_at) AS refreshing
                FROM log_tuning_snapshots WHERE organization_id = $1`, [HANASAND_ORGANIZATION_ID])
            const row = result.rows[0]
            const generatedAt = row?.generated_at ? new Date(row.generated_at).toISOString() : null
            return {
                organizationId: HANASAND_ORGANIZATION_ID,
                generatedAt,
                logs: Array.isArray(row?.logs) ? row.logs : [],
                pending: !generatedAt,
                refreshing: Boolean(row?.refreshing),
            } satisfies TuningSnapshot
        })
        const stale = !snapshot.generatedAt || Date.now() - Date.parse(snapshot.generatedAt) >= REFRESH_INTERVAL_MS
        if (stale) void refreshLogTuningSnapshot().catch(error => req.log?.warn?.({ error }, 'Log tuning background refresh failed'))
        const response = stale ? { ...snapshot, refreshing: true } : snapshot
        res.header('vary', 'Cookie')
        res.header('cache-control', response.refreshing ? 'private, no-store' : 'private, max-age=60')
        return res.send(response)
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
        invalidateReadCache(TUNING_SNAPSHOT_CACHE_KEY)
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
        const existing = (await run(`SELECT generated_at::text AS generated_at, refresh_requested_at::text AS refresh_requested_at, logs
            FROM log_tuning_snapshots WHERE organization_id = $1`, [HANASAND_ORGANIZATION_ID])).rows[0]
        const generatedAt = existing?.generated_at ? Date.parse(existing.generated_at) : 0
        const requestedAt = existing?.refresh_requested_at ? Date.parse(existing.refresh_requested_at) : 0
        const hasCurrentMetrics = Array.isArray(existing?.logs) && existing.logs.every((log: unknown) => log !== null
            && typeof log === 'object' && Object.hasOwn(log, 'last_triggered') && Object.hasOwn(log, 'last_24h_count'))
        if (generatedAt && hasCurrentMetrics && requestedAt <= generatedAt && Date.now() - generatedAt < REFRESH_INTERVAL_MS) return 'current'
        // This full-history aggregation reads and groups the entire stored-log
        // corpus. Let request traffic take priority instead of competing with
        // previews and other foreground database work.
        // This full-history aggregation must not overlap any active database
        // work such as an online index build; one extra scan can exhaust the
        // PgBouncer server pool and make foreground API requests time out.
        if (!(await isDatabaseLowLoad(0))) return 'busy'

        const startedAt = new Date().toISOString()
        const result = await queryLogTuning()
        await run(`INSERT INTO log_tuning_snapshots (organization_id, logs, generated_at, refresh_requested_at)
            VALUES ($1, $2::jsonb, $3::timestamptz, $3::timestamptz)
            ON CONFLICT (organization_id) DO UPDATE SET logs = EXCLUDED.logs, generated_at = EXCLUDED.generated_at,
                refresh_requested_at = GREATEST(log_tuning_snapshots.refresh_requested_at, EXCLUDED.refresh_requested_at)`,
        [HANASAND_ORGANIZATION_ID, JSON.stringify(result), startedAt])
        invalidateReadCache(TUNING_SNAPSHOT_CACHE_KEY)
        return 'refreshed'
    }).finally(() => { refreshInFlight = undefined })
    return refreshInFlight
}

async function queryLogTuning(): Promise<TuningLog[]> {
    return withTransaction(async query => {
        // SYSTEM samples heap pages instead of reading every stored event.
        await query('SET LOCAL statement_timeout = \'120s\'')
        await query('SET LOCAL temp_file_limit = \'4GB\'')
        await query('SET LOCAL work_mem = \'1GB\'')
        const result = await query(`SELECT
                message, ip, ip_path, user_agent, user_agent_path,
                MAX(last_triggered)::text AS last_triggered,
                (COUNT(*) FILTER (WHERE event_timestamp >= NOW() - INTERVAL '24 hours') * 100)::numeric::text AS last_24h_count,
                (COUNT(*) * 100)::numeric::text AS event_count,
                (SUM(pg_column_size(event)) * 100)::numeric::text AS storage_bytes
            FROM events TABLESAMPLE SYSTEM (1.0) AS event
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
