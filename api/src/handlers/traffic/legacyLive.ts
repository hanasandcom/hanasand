import type { FastifyReply, FastifyRequest } from 'fastify'
import { safeTrafficQuery } from './legacyQuery.ts'
import { readTrafficQueryString } from './legacyRequest.ts'

export async function getLegacyTrafficLive(req: FastifyRequest, res: FastifyReply) {
    res.hijack()
    const raw = res.raw
    raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    })

    let closed = false
    const domain = readTrafficQueryString(req, 'domain')?.trim() || null
    const after = Number(readTrafficQueryString(req, 'after') || 0)
    let lastSeenId = Number.isSafeInteger(after) && after > 0 ? after : 0
    const initialWindowStartedAt = new Date(Date.now() - 2 * 60 * 1000)

    const send = (event: string, data: unknown) => {
        if (closed) return
        raw.write(`event: ${event}\n`)
        raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    let reading = false
    const sendBatch = async () => {
        if (closed || reading) return
        reading = true
        try {
            const result = await safeTrafficQuery(`
                WITH recent AS (
                    SELECT id, country_iso, created_at
                    FROM traffic_events
                    WHERE country_iso <> ''
                      AND id > $1
                      AND ($3::text IS NULL OR domain = $3)
                      AND ($1::bigint > 0 OR created_at >= $2)
                    ORDER BY id ASC
                    LIMIT 1000
                )
                SELECT country_iso AS iso, COUNT(*)::int AS count, MAX(id)::text AS max_id, MAX(created_at)::text AS timestamp
                FROM recent
                GROUP BY country_iso
                ORDER BY count DESC
            `, [lastSeenId, initialWindowStartedAt, domain])

            if (result.rows.length) {
                lastSeenId = Math.max(lastSeenId, ...result.rows.map((row: { max_id: string }) => Number(row.max_id || 0)))
                send('traffic', result.rows)
            } else {
                raw.write(': heartbeat\n\n')
            }
        } finally {
            reading = false
        }
    }

    send('ready', { status: 'connected' })
    void sendBatch().catch(error => send('traffic-error', { message: error instanceof Error ? error.message : 'Traffic stream query failed' }))

    const interval = setInterval(() => {
        void sendBatch().catch(error => {
            send('traffic-error', {
                message: error instanceof Error ? error.message : 'Traffic stream query failed',
            })
        })
    }, 3000)

    raw.on('close', () => {
        closed = true
        clearInterval(interval)
    })
}
