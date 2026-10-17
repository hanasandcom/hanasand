import type { FastifyReply, FastifyRequest } from 'fastify'
import { cachedLogQuery } from '../../utils/logs/cache.ts'
import { safeTrafficQuery } from './legacyQuery.ts'

export async function getLegacyTrafficRecords(req: FastifyRequest, res: FastifyReply) {
    const query = req.query as { limit?: string, page?: string, domain?: string }
    const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200)
    const page = Math.max(Number(query.page || 1), 1)
    const offset = (page - 1) * limit
    const domain = typeof query.domain === 'string' && query.domain.trim() ? query.domain.trim() : null
    const [records, total] = await Promise.all([
        safeTrafficQuery(`
            SELECT
                id,
                user_agent,
                domain,
                path,
                method,
                referer,
                request_time_ms AS request_time,
                status,
                country_iso,
                created_at AS timestamp
            FROM traffic_events
            WHERE ($1::text IS NULL OR domain = $1)
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `, [domain, limit, offset]),
        loadTrafficRecordTotal(domain),
    ])

    return res.send({ result: records.rows, total: Number(total.rows[0]?.total || 0) })
}

export function loadTrafficRecordTotal(domain: string | null) {
    return cachedLogQuery(`traffic:record-total:${JSON.stringify(domain)}`, 30000, () => safeTrafficQuery(`
        SELECT COUNT(*)::bigint AS total
        FROM traffic_events
        WHERE ($1::text IS NULL OR domain = $1)
    `, [domain]))
}
