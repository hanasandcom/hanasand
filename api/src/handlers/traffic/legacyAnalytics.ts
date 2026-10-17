import type { FastifyReply, FastifyRequest } from 'fastify'
import { safeTrafficQuery } from './legacyQuery.ts'
import { readTrafficQueryString } from './legacyRequest.ts'

type TrafficMetric = 'path' | 'ip' | 'user_agent' | 'domain'

const emptyMetrics = {
    total_requests: 0,
    avg_request_time: 0,
    error_rate: 0,
    top_methods: [],
    top_status_codes: [],
    top_domains: [],
    top_os: [],
    top_browsers: [],
    requests_over_time: [],
    top_error_paths: [],
    top_slow_paths: [],
    top_paths: [],
}

const metricColumns: Record<TrafficMetric, string> = {
    path: 'path',
    ip: 'ip',
    user_agent: 'user_agent',
    domain: 'domain',
}

export async function getLegacyTrafficSummary(req: FastifyRequest, res: FastifyReply) {
    const metric = readTrafficQueryString(req, 'metric') || 'path'
    if (!isTrafficMetric(metric)) {
        return res.status(400).send({
            error: 'Unsupported traffic summary metric.',
            allowed: ['path', 'ip', 'user_agent', 'domain'],
        })
    }

    return res.send((await loadTrafficSummary(metric)).rows)
}

export async function loadTrafficSummary(metric: TrafficMetric) {
    const column = metricColumns[metric]
    return safeTrafficQuery(`
        SELECT
            ${column} AS value,
            SUM(hits) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::int AS hits_hour,
            SUM(hits) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS hits_today,
            SUM(hits) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS hits_last_week,
            SUM(hits) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS hits_this_month,
            SUM(hits)::int AS hits_total
        FROM traffic_aggregate_events
        WHERE ${column} <> ''
        GROUP BY ${column}
        ORDER BY hits_today DESC, hits_last_week DESC, hits_total DESC
        LIMIT 20
    `)
}

export async function getLegacyTrafficRecent(_req: FastifyRequest, res: FastifyReply) {
    return res.send((await loadTrafficRecent()).rows)
}

export async function loadTrafficRecent() {
    return safeTrafficQuery(`
        SELECT
            path AS value,
            path,
            'path' AS metric,
            SUM(hits)::int AS hits,
            MAX(last_seen)::text AS last_seen,
            MIN(first_seen)::text AS created_at
        FROM traffic_aggregate_events
        WHERE path <> ''
        GROUP BY path
        ORDER BY last_seen DESC
        LIMIT 40
    `)
}

export async function getLegacyTrafficTps(_req: FastifyRequest, res: FastifyReply) {
    const result = await safeTrafficQuery(`
        SELECT
            domain AS name,
            ROUND((COUNT(*)::numeric / 60.0), 3)::float AS tps
        FROM traffic_events
        WHERE domain <> ''
          AND created_at >= NOW() - INTERVAL '60 seconds'
        GROUP BY domain
        ORDER BY tps DESC
        LIMIT 20
    `)

    return res.send(result.rows)
}

export async function getLegacyTrafficIps(_req: FastifyRequest, res: FastifyReply) {
    return res.send((await trafficActors('ip')).rows)
}

export async function getLegacyTrafficUserAgents(_req: FastifyRequest, res: FastifyReply) {
    return res.send((await trafficActors('user_agent')).rows)
}

export function trafficActors(actor: 'ip' | 'user_agent') {
    const related = actor === 'ip' ? 'user_agent' : 'ip'
    const relatedLabel = `most_common_${related}`
    return safeTrafficQuery(`
        WITH grouped AS MATERIALIZED (
            SELECT ${actor}, ${related}, path, SUM(hits)::bigint AS hits
            FROM traffic_aggregate_events WHERE ${actor} <> ''
            GROUP BY ${actor}, ${related}, path
        ), leaders AS (
            SELECT ${actor}, SUM(hits)::bigint AS hits FROM grouped
            GROUP BY ${actor} ORDER BY hits DESC LIMIT 20
        ), relevant AS MATERIALIZED (
            SELECT grouped.* FROM grouped JOIN leaders USING (${actor})
        ), related_ranked AS (
            SELECT ${actor}, ${related},
                ROW_NUMBER() OVER (PARTITION BY ${actor} ORDER BY SUM(hits) DESC, ${related}) AS rank
            FROM relevant WHERE ${related}<>'' GROUP BY ${actor}, ${related}
        ), paths_ranked AS (
            SELECT ${actor}, path, SUM(hits)::bigint AS hits,
                ROW_NUMBER() OVER (PARTITION BY ${actor} ORDER BY SUM(hits) DESC, path) AS rank
            FROM relevant WHERE path<>'' GROUP BY ${actor}, path
        ), path_lists AS (
            SELECT ${actor}, json_agg(json_build_object('path',path,'hits',hits) ORDER BY hits DESC,path) AS paths
            FROM paths_ranked WHERE rank<=20 GROUP BY ${actor}
        )
        SELECT leaders.*, COALESCE(related_ranked.${related}, '') AS ${relatedLabel},
            COALESCE(path_lists.paths, '[]'::json) AS top_paths
        FROM leaders
        LEFT JOIN related_ranked ON related_ranked.${actor}=leaders.${actor} AND related_ranked.rank=1
        LEFT JOIN path_lists ON path_lists.${actor}=leaders.${actor}
        ORDER BY leaders.hits DESC
    `)
}

export async function getLegacyTrafficDomains(_req: FastifyRequest, res: FastifyReply) {
    return res.send(await loadTrafficDomains())
}

export async function loadTrafficDomains() {
    const result = await safeTrafficQuery(`
        SELECT domain
        FROM traffic_aggregate_events
        WHERE domain <> ''
        GROUP BY domain
        ORDER BY MAX(last_seen) DESC, SUM(hits) DESC
        LIMIT 50
    `)

    return { domains: result.rows.map((row: { domain: string }) => row.domain) }
}

export async function getLegacyTrafficMetrics(req: FastifyRequest, res: FastifyReply) {
    return res.send(await loadTrafficMetrics(readTrafficQueryString(req, 'domain') || null))
}

export async function loadTrafficMetrics(domain: string | null) {
    const top = (expression: string) => `COALESCE((SELECT json_agg(t) FROM (
        SELECT ${expression} AS key, SUM(hits)::bigint AS count FROM traffic_scope
        WHERE ${expression} <> '' GROUP BY ${expression} ORDER BY count DESC LIMIT 10
    ) t), '[]'::json)`
    const result = await safeTrafficQuery(`
        WITH traffic_scope AS MATERIALIZED (
            SELECT domain,path,method,status,user_agent,created_at,hits,time_total FROM traffic_aggregate_events WHERE ($1::text IS NULL OR domain=$1)
        )
        SELECT COALESCE(SUM(hits),0)::bigint AS total_requests,
            COALESCE(ROUND(SUM(time_total)/NULLIF(SUM(hits),0)),0) AS avg_request_time,
            COALESCE(1.0 * SUM(hits) FILTER (WHERE status>=400)/NULLIF(SUM(hits),0),0)::float AS error_rate,
            ${top('method')} AS top_methods,
            ${top('status::text')} AS top_status_codes,
            ${top('domain')} AS top_domains,
            ${top('user_agent')} AS top_browsers,
            ${top('path')} AS top_paths,
            COALESCE((SELECT json_agg(t) FROM (
                SELECT path AS key, ROUND(SUM(time_total)/NULLIF(SUM(hits),0)) AS avg_time
                FROM traffic_scope WHERE path<>'' GROUP BY path ORDER BY avg_time DESC LIMIT 10
            ) t), '[]'::json) AS top_slow_paths,
            COALESCE((SELECT json_agg(t) FROM (
                SELECT path AS key,SUM(hits)::bigint AS count FROM traffic_scope
                WHERE path<>'' AND status>=400 GROUP BY path ORDER BY count DESC LIMIT 10
            ) t), '[]'::json) AS top_error_paths,
            COALESCE((SELECT json_agg(t) FROM (
                SELECT date_trunc('hour',created_at)::text AS key,SUM(hits)::bigint AS count
                FROM traffic_scope WHERE created_at>=NOW()-INTERVAL '24 hours'
                GROUP BY date_trunc('hour',created_at) ORDER BY key
            ) t), '[]'::json) AS requests_over_time
        FROM traffic_scope
    `, [domain])
    return { ...emptyMetrics, ...result.rows[0], sampled_at: result.sampled_at }
}

export function isTrafficMetric(value: string): value is TrafficMetric {
    return value === 'path' || value === 'ip' || value === 'user_agent' || value === 'domain'
}
