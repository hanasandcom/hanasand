import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { cachedLogQuery } from '#utils/logs/cache.ts'
import { requireLogAccess } from './access.ts'
import { loadErrorSummary } from './errorSummary.ts'
import {
    authStatusCode,
    expectedHttpProbePredicate,
    expectedTrafficProbePredicate,
} from './errorPredicates.ts'

type ErrorQuery = {
    limit?: string
    surface?: string
    status?: string
    code?: string
    q?: string
    includeExpected?: string
}

export async function getErrorEvents(req: FastifyRequest, res: FastifyReply) {
    if (!(await requireLogAccess(req, res))) return

    return res.send(await loadErrorEvents(req.query as ErrorQuery))
}

export function loadErrorEvents(query: ErrorQuery = {}) {
    return cachedLogQuery(`errors:${JSON.stringify(query)}`, 5000, () => queryErrorEvents(query))
}

async function queryErrorEvents(query: ErrorQuery) {
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const status = Number(query.status || 0)
    const normalizedStatus = Number.isFinite(status) && status >= 400 ? status : null
    const surface = normalizeFilter(query.surface)
    const code = normalizeFilter(query.code)
    const q = typeof query.q === 'string' && query.q.trim() ? query.q.trim().slice(0, 120) : null
    const includeExpected = ['1', 'true', 'yes'].includes(String(query.includeExpected || '').toLowerCase())
    const [httpRows, authRows, trafficRows, summary] = await Promise.all([
        run(`
            SELECT
                ('log-' || id) AS id,
                'api' AS source,
                normalized->>'service' AS service,
                normalized->'metadata'->>'surface' AS surface,
                normalized->'metadata'->>'method' AS method,
                normalized->'metadata'->>'path' AS path,
                NULLIF(normalized->'metadata'->>'status_code', '')::int AS status_code,
                normalized->'metadata'->>'error_code' AS error_code,
                COALESCE(normalized->'metadata'->>'error_message', normalized->>'message') AS message,
                normalized->'metadata'->>'request_id' AS request_id,
                normalized->'metadata'->>'user_id' AS user_id,
                normalized->>'level' AS level,
                event_timestamp AS created_at
            FROM events
            WHERE ingestion_id='logs' AND processing_status='processed'
              AND normalized->'metadata'->>'category' IN ('http_response_error', 'application_error')
              AND ($1::text IS NULL OR normalized->'metadata'->>'surface' = $1)
              AND ($2::int IS NULL OR NULLIF(normalized->'metadata'->>'status_code', '')::int = $2)
              AND ($3::text IS NULL OR normalized->'metadata'->>'error_code' = $3)
              AND ($4::text IS NULL OR normalized->>'message' ILIKE '%' || $4 || '%' OR (normalized->'metadata')::text ILIKE '%' || $4 || '%')
              AND ($5::boolean OR NOT COALESCE(${expectedHttpProbePredicate('normalized->\'metadata\'')}, FALSE))
            ORDER BY event_timestamp DESC
            LIMIT $6
        `, [surface, normalizedStatus, code, q, includeExpected, limit]),
        run(`
            SELECT
                ('login-' || id::text) AS id,
                'auth' AS source,
                'hanasand-api' AS service,
                'auth' AS surface,
                'POST' AS method,
                '/api/auth/login/:id' AS path,
                ${authStatusCode} AS status_code,
                reason AS error_code,
                reason AS message,
                '' AS request_id,
                user_id,
                CASE WHEN status = 'success' THEN 'info' ELSE 'warn' END AS level,
                created_at
            FROM login_events
            WHERE status <> 'success'
              AND ($1::text IS NULL OR $1 = 'auth')
              AND ($2::int IS NULL OR ${authStatusCode} = $2)
              AND ($3::text IS NULL OR reason = $3)
              AND ($4::text IS NULL OR user_id ILIKE '%' || $4 || '%' OR reason ILIKE '%' || $4 || '%')
            ORDER BY created_at DESC
            LIMIT $5
        `, [surface, normalizedStatus, code, q, limit]),
        run(`
            SELECT
                ('traffic-' || id::text) AS id,
                'traffic' AS source,
                'frontend' AS service,
                'website' AS surface,
                method,
                path,
                status AS status_code,
                ('http_' || status::text) AS error_code,
                (method || ' ' || path || ' responded with ' || status::text) AS message,
                '' AS request_id,
                '' AS user_id,
                CASE WHEN status >= 500 THEN 'error' ELSE 'warn' END AS level,
                created_at
            FROM traffic_events
            WHERE status >= 400
              AND ($1::text IS NULL OR $1 = 'website')
              AND ($2::int IS NULL OR status = $2)
              AND ($3::text IS NULL OR ('http_' || status::text) = $3)
              AND ($4::text IS NULL OR path ILIKE '%' || $4 || '%')
              AND ($5::boolean OR NOT ${expectedTrafficProbePredicate()})
            ORDER BY created_at DESC
            LIMIT $6
        `, [surface, normalizedStatus, code, q, includeExpected, Math.min(limit, 100)]),
        loadErrorSummary(includeExpected),
    ])

    const errors = [...httpRows.rows, ...authRows.rows, ...trafficRows.rows]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)

    return {
        generated_at: new Date().toISOString(),
        ...summary,
        warnings: summary.summary_warning ? [summary.summary_warning] : [],
        errors,
    }
}

function normalizeFilter(value: string | undefined) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return text && text !== 'all' ? text.slice(0, 120) : null
}
