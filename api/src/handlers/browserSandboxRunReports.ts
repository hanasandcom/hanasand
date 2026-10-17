import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import run from '#db'
import { sessionNetwork } from '../utils/auth/sessionNetwork.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { browserResultId } from '../utils/ws/browserResultIdentity.ts'
import { buildStoredBrowserReport } from '../utils/ws/browserRunViews.ts'
import { cleanClientId, hashValue, loadAccessibleBrowserRun } from '../utils/ws/browserRunIdentity.ts'

type BrowserReportParams = { id: string }
type BrowserReportQuery = { clientId?: string; token?: string }
type BrowserReportBody = { clientId?: string; report?: unknown }

export const maxBrowserReportBytes = 32_000_000

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

export async function persistBrowserRunEvidence(id: string, payload: Record<string, any>) {
    if (!['frame', 'tool_capture', 'console', 'pageerror', 'downloads', 'status', 'navigation_error', 'error', 'ended'].includes(payload?.type)) return
    await run('INSERT INTO browser_run_evidence (run_id, payload) VALUES ($1, $2::jsonb)', [id, JSON.stringify(payload)])
}

export async function getBrowserResult(req: FastifyRequest<{ Params: { id: string }; Querystring: { clientId?: string; run?: string } }>, res: FastifyReply) {
    try {
        if (!isBrowserResultId(req.params.id)) return res.status(404).send({ error: 'Result not found.' })
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


function isBrowserResultId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
}
