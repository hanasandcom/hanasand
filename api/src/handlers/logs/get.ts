import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { cachedLogQuery } from '#utils/logs/cache.ts'
import { requireLogAccess } from './access.ts'
import { isRuntimeLogSourceAvailable, listRuntimeLogs } from '#utils/docker/engine.ts'
import { isNativeLogSourceAvailable, listNativeLogs, listNativeLogServices } from '#utils/logs/native.ts'
import { mergeLogServices } from '#utils/logs/services.ts'

export async function getLogServices(req: FastifyRequest, res: FastifyReply) {
    if (!(await requireLogAccess(req, res))) return

    return res.send(await loadLogServices())
}

export function loadLogServices() {
    // Exact per-service counts scan the full raw log table, so refresh this snapshot less often.
    return cachedLogQuery('services', 240_000, queryLogServices)
}

async function queryLogServices() {
    const result = await withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'30s\'')
        return query(`
        SELECT normalized->>'service' AS service, MAX(event_timestamp) AS last_seen, COUNT(*)::int AS entries
        FROM events WHERE ingestion_id='logs' AND processing_status='processed'
        GROUP BY normalized->>'service'
        ORDER BY service ASC
        `)
    })
    const nativeServices = await listNativeLogServices().catch(() => [])
    return { services: mergeLogServices([result.rows, nativeServices]) }
}

export async function getLogs(req: FastifyRequest, res: FastifyReply) {
    if (!(await requireLogAccess(req, res))) return

    return res.send(await loadLogs(req.query as LogQuery))
}

type LogQuery = { service?: string, level?: string, search?: string, limit?: string }

export function loadLogs(query: LogQuery = {}) {
    return cachedLogQuery(`logs:${JSON.stringify(query)}`, 5000, () => queryLogs(query))
}

async function queryLogs(query: LogQuery) {
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const [result, nativeLogs] = await Promise.all([
        run(`
        SELECT id, normalized->>'service' AS service, normalized->>'host' AS host,
            normalized->>'level' AS level, normalized->>'message' AS message,
            normalized->'metadata' AS metadata, event_timestamp AS created_at
        FROM events
        WHERE ingestion_id='logs' AND processing_status='processed'
          AND ($1::text IS NULL OR normalized->>'service' = $1)
          AND ($2::text IS NULL OR normalized->>'level' = $2)
          AND ($3::text IS NULL OR normalized->>'message' ILIKE '%' || $3 || '%')
        ORDER BY event_timestamp DESC
        LIMIT $4
    `, [query.service || null, query.level || null, query.search || null, limit]),
        listNativeLogs({
            service: query.service || null,
            level: query.level || null,
            search: query.search || null,
            limit,
        }).catch(() => []),
    ])

    const logs = [...result.rows.map((row) => ({ ...row, source: 'stored' as const })), ...nativeLogs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)

    return { logs }
}

export async function getRealtimeLogs(req: FastifyRequest, res: FastifyReply) {
    if (!(await requireLogAccess(req, res))) return

    const query = req.query as { service?: string, limit?: string, since?: string }
    const limit = Math.min(Math.max(Number(query.limit || 300), 1), 1000)
    const nativeAvailable = isNativeLogSourceAvailable()

    try {
        const [runtime, nativeLogs] = await Promise.all([
            listRuntimeLogs({
                service: query.service,
                since: query.since,
                limit,
            }),
            listNativeLogs({
                service: query.service || null,
                limit: Math.min(limit, 250),
            }).catch(() => []),
        ])

        return res.send({
            logs: [...runtime.logs, ...nativeLogs]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, limit),
            containers: runtime.containers,
            runtime_available: runtime.available,
            native_available: nativeAvailable,
            source: 'docker_engine',
            generated_at: new Date().toISOString(),
        })
    } catch (error: any) {
        const nativeLogs = await listNativeLogs({
            service: query.service || null,
            limit: Math.min(limit, 250),
        }).catch(() => [])

        return res.send({
            logs: nativeLogs,
            containers: [],
            runtime_available: false,
            native_available: nativeAvailable,
            source: 'docker_engine',
            unavailable_reason: error?.message || 'Failed to load runtime logs.',
            docker_socket_available: isRuntimeLogSourceAvailable(),
            generated_at: new Date().toISOString(),
        })
    }
}
