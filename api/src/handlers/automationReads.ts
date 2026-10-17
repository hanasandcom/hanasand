import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { automationReadScope } from '#utils/automationAccess.ts'
import { loadMonitoringIssues } from '#utils/monitoringIssues.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { toAutomation, toAutomationRun, type AutomationRow, type AutomationRunRow } from '#utils/automations.ts'
import { canManageAllAutomations } from './automationHandlerSupport.ts'

export async function getAutomations(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const canManageSystem = await canManageAllAutomations(req)
    const includeAll = canManageSystem && (req.query as { scope?: string }).scope !== 'personal'
    const result = await run(`
        SELECT a.*, stats.history, stats.uptime,
            ARRAY(SELECT 'HA-' || i.id FROM monitoring_issues i WHERE i.merged_into IS NULL AND (i.automation_id = a.id OR EXISTS (SELECT 1 FROM monitoring_issue_checks c WHERE c.issue_id=i.id AND c.automation_id=a.id)) ORDER BY i.last_seen_at DESC) AS case_numbers
        FROM agent_automations a
        LEFT JOIN LATERAL (
            SELECT COALESCE(jsonb_agg(item ORDER BY item.started_at), '[]'::jsonb) AS history,
                (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed' AND NOT warning) / NULLIF(COUNT(*) FILTER (WHERE status <> 'running'), 0), 2)
                 FROM agent_automation_runs WHERE automation_id = a.id) AS uptime
            FROM (SELECT id, status, warning, started_at FROM agent_automation_runs WHERE automation_id = a.id ORDER BY started_at DESC, id DESC LIMIT 12) item
        ) stats ON true
        WHERE ${automationReadScope('a', '$1', '$2')}
          AND status <> 'archived'
        ORDER BY updated_at DESC, created_at DESC
    `, [includeAll, id])

    return res.send({ canManageSystem, automations: result.rows.map(row => ({ ...toAutomation(row as AutomationRow), history: row.history, uptime: row.uptime === null ? null : Number(row.uptime) })) })
}

export async function getAutomation(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const includeAll = await canManageAllAutomations(req)
    const automation = await loadAutomation(req.params.id, ownerId, includeAll)
    if (!automation) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    try {
        const page = await loadRuns(req.params.id, ownerId, includeAll, req.query as Record<string, string>)
        return res.send({ automation: toAutomation(automation), ...page, issues: await loadMonitoringIssues(automation.id) })
    } catch (error) {
        if (error instanceof RangeError) return res.status(400).send({ error: error.message })
        throw error
    }
}

export async function loadAutomation(id: string, ownerId: string, includeAll = false, mutate = false) {
    const result = await run(`
        SELECT *
        FROM agent_automations
        WHERE id = $1
          AND ${automationReadScope('agent_automations', '$2', '$3', mutate)}
          AND status <> 'archived'
    `, [id, includeAll, ownerId])

    return (result.rows as AutomationRow[])[0] || null
}

export async function loadRuns(automationId: string, ownerId: string, includeAll = false, options: Record<string, string> = {}) {
    const date = (value: string | undefined) => {
        if (!value) return null
        if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new RangeError('Invalid history date.')
        return new Date(value).toISOString()
    }
    const page = Number(options.page || 1)
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * 50) || (options.page !== undefined && options.cursor)) throw new RangeError('Invalid history page.')
    let cursor: { at: string, id: string } | null = null
    if (options.cursor) {
        try {
            cursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString())
            if (!cursor || typeof cursor.id !== 'string' || !cursor.id || !date(cursor.at)) throw new Error()
        } catch { throw new RangeError('Invalid history cursor.') }
    }
    const from = date(options.from)
    const to = date(options.to)
    if (from && to && from > to) throw new RangeError('Start date must be before end date.')
    const values = [automationId, includeAll, ownerId, from, to]
    const where = `automation_id = $1 AND ($2::BOOLEAN OR owner_id = $3)
        AND ($4::timestamptz IS NULL OR started_at >= $4) AND ($5::timestamptz IS NULL OR started_at <= $5)`
    const [count, result] = await Promise.all([
        run(`SELECT COUNT(*)::INT AS total FROM agent_automation_runs WHERE ${where}`, values),
        run(`SELECT *, started_at::text AS cursor_at FROM agent_automation_runs WHERE ${where}
            AND ($6::timestamptz IS NULL OR (started_at, id) < ($6::timestamptz, $7::text))
            ORDER BY started_at DESC, id DESC LIMIT 51 OFFSET $8`, [...values, cursor?.at || null, cursor?.id || null, (page - 1) * 50]),
    ])
    const rows = result.rows.slice(0, 50) as (AutomationRunRow & { cursor_at: string })[]
    const last = rows.at(-1)
    return {
        runs: rows.map(toAutomationRun), total: count.rows[0].total,
        page, nextPage: result.rows.length > 50 ? page + 1 : null,
        nextCursor: result.rows.length > 50 && last ? Buffer.from(JSON.stringify({ at: last.cursor_at, id: last.id })).toString('base64url') : null,
    }
}
