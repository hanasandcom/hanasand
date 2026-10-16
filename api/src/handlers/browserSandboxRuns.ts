import { sessionNetwork } from '../utils/auth/sessionNetwork.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHash, randomUUID } from 'node:crypto'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { validateSession } from '#utils/auth/session.ts'
import { browserResultId } from '../utils/ws/browserResultIdentity.ts'
import { BrowserLeaseExpiredError } from '../utils/ws/browserLease.ts'
import { browserAccess, type BrowserAccess } from '../utils/ws/browserAccess.ts'
import { buildStoredBrowserReport, rowToBrowserHistoryRecord, rowToBrowserRunRecord, type BrowserNetwork, type BrowserProviderRunResult, type BrowserRunRecord } from '../utils/ws/browserRunViews.ts'

export type { BrowserNetwork, BrowserProviderRunResult, BrowserRunRecord } from '../utils/ws/browserRunViews.ts'
export { buildStoredBrowserReport } from '../utils/ws/browserRunViews.ts'

export type BrowserQuota = BrowserAccess & {
    plan: string
    limit: null
    used: number
    active: number
    remaining: null
    resetsAt: string | null
    identityKind: 'anonymous' | 'user'
}

type BrowserRunStats = {
    runs24h: number
    darkwebRuns24h: number
}

type BrowserRunIdentity = {
    identityKind: 'anonymous' | 'user'
    quotaIdentity: string
    quotaPlan: string
    ownerId: string | null
    clientIdHash: string | null
    periodStart: Date | null
    access: BrowserAccess
}

type PrepareBrowserRunInput = {
    id: string
    target: string
    network: BrowserNetwork
    clientId?: string
    userId?: string
    sessionToken?: string
}

type BrowserReportParams = { id: string }
type BrowserReportQuery = { clientId?: string; token?: string }
type BrowserReportBody = { clientId?: string; report?: unknown }
type BrowserRunDeleteBody = { clientId?: string; ids?: string[]; clear?: boolean }

export const maxBrowserReportBytes = 32_000_000
let browserRunStatsCache: { expiresAt: number; value: BrowserRunStats } | null = null
const browserRunStatsCacheTtlMs = 60_000

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

export async function getBrowserRunReport(req: FastifyRequest<{ Params: BrowserReportParams, Querystring: BrowserReportQuery }>, res: FastifyReply) {
    try {
        const row = await loadAccessibleBrowserRun(req, res, req.params.id, req.query?.clientId, req.query?.token)
        if (!row) return res.status(404).send({ error: 'Report not found.' })
        let report = row.metadata?.report
        if (!report) {
            const evidence = await run('SELECT payload FROM browser_run_evidence WHERE run_id = $1 ORDER BY id', [req.params.id])
            report = buildStoredBrowserReport(row, undefined, evidence.rows.map(item => item.payload), [row])
        }
        return res.send(report)
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load browser report.' })
    }
}

export async function postBrowserRunReport(req: FastifyRequest<{ Params: BrowserReportParams, Body: BrowserReportBody }>, res: FastifyReply) {
    try {
        const row = await loadAccessibleBrowserRun(req, res, req.params.id, req.body?.clientId)
        if (!row) return res.status(404).send({ error: 'Run not found.' })
        const report = req.body?.report
        const encoded = JSON.stringify(report)
        if (!report || Buffer.byteLength(encoded, 'utf8') > maxBrowserReportBytes) return res.status(400).send({ error: 'Report is missing or too large.' })
        const token = row.metadata?.reportToken || randomUUID()
        await run(`
            UPDATE browser_runs
            SET metadata = metadata || $2::jsonb,
                updated_at = NOW()
            WHERE id = $1
        `, [req.params.id, JSON.stringify({
            report,
            reportToken: token,
            reportSavedAt: new Date().toISOString(),
        })])
        return res.send({
            ok: true,
            resultId: browserResultId(String(row.target)),
            reportUrl: `/sandbox/report?run=${encodeURIComponent(req.params.id)}&token=${encodeURIComponent(token)}`,
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to save browser report.' })
    }
}

export async function prepareBrowserRun(input: PrepareBrowserRunInput): Promise<
    { allowed: true; run: BrowserRunRecord; quota: BrowserQuota } |
    { allowed: false; quota: BrowserQuota | null; reason: 'concurrency_limit' | 'identity_required' | 'run_exists' }
> {
    const identity = await browserRunIdentityForSocket(input)
    if (!identity) return { allowed: false, quota: null, reason: 'identity_required' }
    return withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [identity.quotaIdentity])
        const quota = await loadBrowserQuota(identity, query)
        if (quota.active >= quota.concurrentLimit) return { allowed: false as const, quota, reason: 'concurrency_limit' as const }
        const result = await query(`
            INSERT INTO browser_runs (id, owner_id, quota_identity, quota_plan, client_id_hash, target, network, status, metadata, result_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'running', $8::jsonb, $9::uuid)
            ON CONFLICT (id) DO NOTHING
            RETURNING id, target, network, status, title, created_at
        `, [input.id, identity.ownerId, identity.quotaIdentity, identity.quotaPlan, identity.clientIdHash, input.target, input.network,
            JSON.stringify({ identityKind: identity.identityKind, leaseExpiresAt: new Date(Date.now() + 120_000).toISOString() }), browserResultId(input.target)])
        if (!result.rows.length) return { allowed: false as const, quota, reason: 'run_exists' as const }
        browserRunStatsCache = null
        return { allowed: true as const, run: rowToBrowserRunRecord(result.rows[0]), quota: { ...quota, active: quota.active + 1, used: quota.used + 1 } }
    })
}

export async function refreshBrowserRunLease(id: string) {
    const result = await run(`UPDATE browser_runs SET metadata = metadata || jsonb_build_object('leaseExpiresAt', NOW() + INTERVAL '2 minutes')
        WHERE id = $1 AND status IN ('running', 'unreachable')
            AND (metadata->>'leaseExpiresAt')::timestamptz > NOW()`, [id])
    if (!result.rowCount) throw new BrowserLeaseExpiredError('Browser run lease expired')
}

export async function finishBrowserRun(id: string, status: 'ended' | 'failed' | 'unreachable' = 'ended', title = '') {
    if (!id) return
    await run(`
        UPDATE browser_runs
        SET status = CASE
                WHEN $2 = 'ended' AND status IN ('failed', 'unreachable') THEN status
                ELSE $2
            END,
            title = COALESCE(NULLIF($3, ''), title),
            metadata = CASE WHEN $2 IN ('ended', 'failed')
                THEN metadata || jsonb_build_object('leaseExpiresAt', NOW()) ELSE metadata END,
            updated_at = NOW()
        WHERE id = $1
    `, [id, status, title])
}

export async function updateBrowserRunProviderResult(id: string, provider: string, result: BrowserProviderRunResult) {
    if (!id || !/^[a-z0-9_-]+$/i.test(provider)) return
    await run(`
        UPDATE browser_runs
        SET metadata = metadata || jsonb_build_object('providerResults', COALESCE(metadata->'providerResults', '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb)),
            updated_at = NOW()
        WHERE id = $1
    `, [id, provider, JSON.stringify(result)])
}

export async function browserPaidExtensionAllowed(id: string) {
    if (!id) return false
    const result = await run('SELECT owner_id FROM browser_runs WHERE id = $1', [id])
    const owner = result.rows[0]?.owner_id
    return owner ? (await browserRunIdentityForUser(owner)).access.paid : false
}

async function browserRunIdentityForSocket(input: { clientId?: string; userId?: string; sessionToken?: string }) {
    const sessionToken = cleanText(input.sessionToken)
    const userId = cleanText(input.userId)
    const clientId = cleanClientId(input.clientId)
    if (sessionToken) {
        const session = await validateSession({ id: userId || undefined, token: sessionToken })
        if (session?.user?.id) return browserRunIdentityForUser(session.user.id, clientId)
    }
    return browserRunIdentityForClient(clientId)
}

async function browserRunIdentityForRequest(req: FastifyRequest, res: FastifyReply, clientId: unknown) {
    const user = await tokenWrapper(req, res)
    const cleanId = cleanClientId(clientId)
    return user.valid && user.id
        ? browserRunIdentityForUser(user.id, cleanId)
        : browserRunIdentityForClient(cleanId)
}

async function browserRunIdentityForUser(userId: string, clientId?: string): Promise<BrowserRunIdentity> {
    const result = await run(`
        SELECT EXISTS (SELECT 1 FROM billing_entitlements WHERE user_id = $1 AND plan_id = 'browser' AND active IS TRUE) AS paid,
            (SELECT plan FROM browser_subscriptions WHERE owner_id = $1 AND active IS TRUE LIMIT 1) AS legacy_plan
    `, [userId])
    const plan = result.rows[0]?.paid ? 'browser' : cleanText(result.rows[0]?.legacy_plan) || 'free'
    const now = new Date()
    return {
        identityKind: 'user', quotaIdentity: `browser:user:${userId}`, quotaPlan: plan,
        ownerId: userId, clientIdHash: clientId ? hashValue(clientId) : null,
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        access: browserAccess(plan),
    }
}

function browserRunIdentityForClient(clientId?: string): BrowserRunIdentity | null {
    const clean = cleanClientId(clientId)
    if (!clean) return null
    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return {
        identityKind: 'anonymous',
        quotaIdentity: `browser:anonymous:${hashValue(clean)}`,
        quotaPlan: 'anonymous',
        ownerId: null,
        clientIdHash: hashValue(clean),
        periodStart,
        access: browserAccess('anonymous'),
    }
}

function browserRunScope(identity: BrowserRunIdentity) {
    return identity.ownerId
        ? {
            where: '(owner_id = $1 OR ($2::text IS NOT NULL AND client_id_hash = $2))',
            params: [identity.ownerId, identity.clientIdHash],
        }
        : { where: 'client_id_hash = $1', params: [identity.clientIdHash] }
}

async function loadBrowserQuota(identity: BrowserRunIdentity, query: typeof run = run): Promise<BrowserQuota> {
    const result = await query(`
        SELECT COUNT(*) FILTER (WHERE created_at >= $2::timestamptz)::int AS used,
            COUNT(*) FILTER (WHERE status IN ('running', 'unreachable') AND
                COALESCE((metadata->>'leaseExpiresAt')::timestamptz, updated_at + INTERVAL '2 minutes') > NOW())::int AS active
        FROM browser_runs WHERE quota_identity = $1
    `, [identity.quotaIdentity, identity.periodStart?.toISOString() || new Date(0).toISOString()])
    return {
        ...identity.access, plan: identity.quotaPlan, limit: null, used: Number(result.rows[0]?.used || 0),
        active: Number(result.rows[0]?.active || 0), remaining: null, resetsAt: null, identityKind: identity.identityKind,
    }
}

async function loadAccessibleBrowserRun(req: FastifyRequest, res: FastifyReply, id: string, clientId?: string, token?: string) {
    const result = await run('SELECT * FROM browser_runs WHERE id = $1 LIMIT 1', [id])
    const row = result.rows[0] as (Record<string, any> & { metadata?: Record<string, any> }) | undefined
    if (!row || row.metadata?.historyDeletedAt) return null
    if (token && (row.metadata?.reportToken === token || token === id)) return row

    const user = await tokenWrapper(req, res).catch(() => ({ valid: false, id: '' }))
    if (user.valid && user.id && row.owner_id === user.id) return row
    const clientHash = cleanClientId(clientId) ? hashValue(cleanClientId(clientId)) : ''
    if (clientHash && row.client_id_hash === clientHash) return row
    return null
}

function cleanClientId(value: unknown) {
    const text = cleanText(value)
    return /^[a-zA-Z0-9_.:-]{8,160}$/.test(text) ? text : ''
}

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex')
}

export async function persistBrowserRunEvidence(id: string, payload: Record<string, any>) {
    if (!['frame', 'tool_capture', 'console', 'pageerror', 'downloads', 'status', 'navigation_error', 'error', 'ended'].includes(payload?.type)) return
    await run('INSERT INTO browser_run_evidence (run_id, payload) VALUES ($1, $2::jsonb)', [id, JSON.stringify(payload)])
}

export async function getBrowserResult(req: FastifyRequest<{ Params: { id: string }; Querystring: { clientId?: string; run?: string } }>, res: FastifyReply) {
    try {
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id)) return res.status(404).send({ error: 'Result not found.' })
        const user = await tokenWrapper(req, res)
        const clientId = cleanClientId(req.query?.clientId)
        const rows = await run(`SELECT id, target, network, status, created_at, title FROM browser_runs
            WHERE result_id = $1::uuid AND (owner_id = $2 OR client_id_hash = $3)
              AND metadata->>'historyDeletedAt' IS NULL
            ORDER BY created_at DESC, id DESC`, [req.params.id, user.valid ? user.id ?? null : null, clientId ? hashValue(clientId) : null])
        const selected = req.query?.run ? rows.rows.find(row => row.id === req.query.run) : rows.rows[0]
        if (!selected) return res.status(404).send({ error: 'Result not found or unavailable to this account.' })
        const stored = await run('SELECT metadata FROM browser_runs WHERE id = $1', [selected.id])
        const evidence = await run('SELECT payload FROM browser_run_evidence WHERE run_id = $1 ORDER BY id', [selected.id])
        const report = buildStoredBrowserReport(selected, stored.rows[0]?.metadata?.report, evidence.rows.map(row => row.payload), rows.rows)
        // Legacy captures retain the observed IP; enrich locally without resolving the domain again.
        if (report.siteNetwork?.ip && !report.siteNetwork.country_code) {
            const location = await sessionNetwork(report.siteNetwork.ip).catch(() => null)
            report.siteNetwork = { ...report.siteNetwork, ...location?.network }
        }
        return res.header('cache-control', 'private, no-store').send(report)
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Could not load the saved browser result.' })
    }
}

function isBrowserRunId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
}
