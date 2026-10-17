import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { browserAccess } from '../utils/ws/browserAccess.ts'
import { rowToBrowserHistoryRecord, rowToBrowserRunRecord } from '../utils/ws/browserRunViews.ts'
import { browserRunIdentityForRequest, browserRunScope, loadBrowserQuota, type BrowserQuota } from '../utils/ws/browserRunIdentity.ts'

type BrowserRunStats = { runs24h: number; darkwebRuns24h: number }
type BrowserRunDeleteBody = { clientId?: string; ids?: string[]; clear?: boolean }

let browserRunStatsCache: { expiresAt: number; value: BrowserRunStats } | null = null
const browserRunStatsCacheTtlMs = 60_000

export function invalidateBrowserRunStatsCache() {
    browserRunStatsCache = null
}

export async function getBrowserRuns(req: FastifyRequest<{ Querystring: { clientId?: string; history?: string; offset?: string } }>, res: FastifyReply) {
    try {
        const identity = await browserRunIdentityForRequest(req, res, req.query?.clientId)

        if (!identity) {
            return res.send({
                runs: [],
                quota: {
                    plan: 'anonymous',
                    limit: null,
                    used: 0,
                    remaining: null,
                    active: 0,
                    ...browserAccess('anonymous'),
                    resetsAt: null,
                    identityKind: 'anonymous',
                } satisfies BrowserQuota,
            })
        }

        const { where: scope, params } = browserRunScope(identity)
        if (req.query.history === 'all') {
            const offset = Number(req.query.offset || 0)
            if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).send({ error: 'Invalid history offset.' })
            const result = await run(`
                SELECT id, target, network, status, created_at,
                    jsonb_strip_nulls(jsonb_build_object(
                        'virustotal', metadata #> '{providerResults,virustotal}',
                        'urlquery', metadata #> '{providerResults,urlquery}'
                    )) AS provider_results
                FROM browser_runs WHERE ${scope}
                    AND metadata->>'historyDeletedAt' IS NULL
                ORDER BY created_at DESC, id DESC
                LIMIT 51 OFFSET $${params.length + 1}
            `, [...params, offset])
            return res.header('cache-control', 'private, no-store').send({
                runs: result.rows.slice(0, 50).map(rowToBrowserHistoryRecord),
                nextOffset: result.rows.length > 50 ? offset + 50 : null,
            })
        }
        const quota = await loadBrowserQuota(identity)
        const result = await run(`
            SELECT *
            FROM (
                SELECT DISTINCT ON (result_id)
                    id, target, network, status, title, created_at, metadata - 'report' AS metadata,
                    COUNT(*) OVER (PARTITION BY result_id)::int AS check_count
                FROM browser_runs
                WHERE ${scope}
                  AND metadata->>'historyDeletedAt' IS NULL
                ORDER BY result_id, created_at DESC
            ) latest_runs
            ORDER BY created_at DESC
            LIMIT 12
        `, params)

        return res.send({
            runs: result.rows.map(rowToBrowserRunRecord),
            quota,
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load browser runs.' })
    }
}

export async function deleteBrowserRuns(req: FastifyRequest<{ Body: BrowserRunDeleteBody }>, res: FastifyReply) {
    try {
        const identity = await browserRunIdentityForRequest(req, res, req.body?.clientId)

        if (!identity || (!identity.ownerId && !identity.clientIdHash)) {
            return res.status(400).send({ error: 'A browser history identity is required.' })
        }

        const { where: scope, params: scopeParams } = browserRunScope(identity)
        const ids = req.body?.ids
        if (ids !== undefined) {
            if (!Array.isArray(ids) || ids.length < 1 || ids.length > 12 || ids.some(id => !isBrowserRunId(id))) {
                return res.status(400).send({ error: 'Select between 1 and 12 valid browser runs.' })
            }
            const idParam = scopeParams.length + 1
            const result = await run(`
                WITH selected_results AS (
                    SELECT DISTINCT result_id FROM browser_runs
                    WHERE id = ANY($${idParam}::uuid[]) AND ${scope}
                )
                UPDATE browser_runs
                SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('historyDeletedAt', NOW()), updated_at = NOW()
                WHERE ${scope}
                  AND metadata->>'historyDeletedAt' IS NULL
                  AND result_id IN (SELECT result_id FROM selected_results)
                RETURNING id
            `, [...scopeParams, ids])
            return res.header('cache-control', 'private, no-store').send({ deleted: result.rows.length })
        }
        if (req.body?.clear !== true) return res.status(400).send({ error: 'Choose runs to delete or clear browser history.' })

        const result = await run(`
            UPDATE browser_runs
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('historyDeletedAt', NOW()), updated_at = NOW()
            WHERE ${scope} AND metadata->>'historyDeletedAt' IS NULL
            RETURNING id
        `, scopeParams)
        return res.header('cache-control', 'private, no-store').send({ deleted: result.rows.length })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to delete browser history.' })
    }
}

export async function getBrowserRunStats(_req: FastifyRequest, res: FastifyReply) {
    const now = Date.now()
    if (browserRunStatsCache && browserRunStatsCache.expiresAt > now) return res.header('cache-control', 'public, max-age=10, s-maxage=60, stale-while-revalidate=300').send(browserRunStatsCache.value)

    try {
        const result = await run(`
            SELECT
                COUNT(*)::int AS runs_24h,
                COUNT(*) FILTER (WHERE network = 'tor')::int AS darkweb_runs_24h
            FROM browser_runs
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        `)
        const value = {
            runs24h: Number(result.rows[0]?.runs_24h || 0),
            darkwebRuns24h: Number(result.rows[0]?.darkweb_runs_24h || 0),
        } satisfies BrowserRunStats
        browserRunStatsCache = { expiresAt: now + browserRunStatsCacheTtlMs, value }
        return res.header('cache-control', 'public, max-age=10, s-maxage=60, stale-while-revalidate=300').send(value)
    } catch (error) {
        _req.log.error(error)
        return res.status(500).send({ error: 'Failed to load browser run stats.' })
    }
}


function isBrowserRunId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
}
