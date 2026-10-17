import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { prepareImpersonationTimeline, projectImpersonationTimeline } from '../impersonationTimeline.ts'
import { actorHasHanasandInternalAccess } from '#utils/systemEvent.ts'
import { requireNonImpersonatingActor, impersonationError } from './auth.ts'
import { loadImpersonationGuardrailAuditEvents } from './eventAudit.ts'
import type { EventQuery } from './types.ts'

export async function getImpersonationEvents(req: FastifyRequest, res: FastifyReply) {
    const actor = await requireNonImpersonatingActor(req, res)
    if (!actor) return
    if (!await actorHasHanasandInternalAccess(actor.id)) {
        return res.status(403).send({ error: 'Only admins can view impersonation history.' })
    }

    const query = req.query as EventQuery
    const where: string[] = []
    const values: Array<string | number | boolean | string[] | Date | null> = []
    const add = (value: string | number | boolean | string[] | Date | null) => {
        values.push(value)
        return `$${values.length}`
    }
    const q = String(query.q || '').trim()
    const actorFilter = String(query.actor || '').trim()
    const targetFilter = String(query.target || '').trim()
    const actionFilter = String(query.action || '').trim().toLowerCase()
    const outcomeFilter = String(query.outcome || '').trim().toLowerCase()
    const methodFilter = String(query.method || '').trim().toUpperCase()
    const pathFilter = String(query.path || '').trim()
    const sessionFilter = String(query.session || query.supportSession || query.supportSessionId || '').trim()
    const reasonFilter = String(query.reason || '').trim()
    const fromFilter = String(query.from || '').trim()
    const toFilter = String(query.to || '').trim()
    const parsedLimit = Number(query.limit || 200)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500) : 200

    if (q) {
        const placeholder = add(`%${q}%`)
        where.push(`(
            e.actor_id ILIKE ${placeholder}
            OR actor.name ILIKE ${placeholder}
            OR e.object_id ILIKE ${placeholder}
            OR target.name ILIKE ${placeholder}
            OR e.path ILIKE ${placeholder}
            OR e.method ILIKE ${placeholder}
            OR e.ip ILIKE ${placeholder}
            OR e.user_agent ILIKE ${placeholder}
            OR e.session_id::text ILIKE ${placeholder}
            OR session.reason ILIKE ${placeholder}
        )`)
    }
    if (actorFilter) {
        const placeholder = add(`%${actorFilter}%`)
        where.push('(e.actor_id ILIKE ' + placeholder + ' OR actor.name ILIKE ' + placeholder + ')')
    }
    if (targetFilter) {
        const placeholder = add(`%${targetFilter}%`)
        where.push('(e.object_id ILIKE ' + placeholder + ' OR target.name ILIKE ' + placeholder + ')')
    }
    if (actionFilter && !['impersonation.start', 'impersonation.stop', 'start', 'stop'].includes(actionFilter)) {
        return res.status(400).send(impersonationError('unsupported_impersonation_action_filter', 'Unsupported impersonation action filter.', {
            supportedValues: ['impersonation.start', 'impersonation.stop'],
        }))
    }
    if (outcomeFilter && !['success', 'denied', 'failed'].includes(outcomeFilter)) {
        return res.status(400).send(impersonationError('unsupported_impersonation_outcome_filter', 'Unsupported impersonation outcome filter.', {
            supportedValues: ['success', 'denied', 'failed'],
            auditRoute: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
        }))
    }
    if (actionFilter) {
        where.push(`e.path ILIKE ${add(actionFilter.endsWith('stop') ? '%/stop%' : '%/start%')}`)
    }
    if (methodFilter) {
        where.push(`e.method = ${add(methodFilter)}`)
    }
    if (pathFilter) {
        where.push(`e.path ILIKE ${add(`%${pathFilter}%`)}`)
    }
    if (sessionFilter) {
        where.push(`e.session_id::text ILIKE ${add(`%${sessionFilter}%`)}`)
    }
    if (reasonFilter) {
        where.push(`session.reason ILIKE ${add(`%${reasonFilter}%`)}`)
    }
    if (fromFilter && !Number.isNaN(Date.parse(fromFilter))) {
        where.push(`e.created_at >= ${add(new Date(fromFilter).toISOString())}`)
    }
    if (toFilter && !Number.isNaN(Date.parse(toFilter))) {
        where.push(`e.created_at <= ${add(new Date(toFilter).toISOString())}`)
    }

    const includeLifecycle = !outcomeFilter || outcomeFilter === 'success'
    const result = includeLifecycle ? await run(`
        SELECT
            e.id,
            e.session_id,
            e.actor_id,
            actor.name AS actor_name,
            e.object_id,
            target.name AS target_name,
            e.method,
            e.path,
            e.ip,
            e.user_agent,
            e.created_at,
            session.reason AS session_reason,
            session.created_at AS session_created_at,
            session.expires_at AS session_expires_at,
            session.revoked_at AS session_revoked_at
        FROM impersonation_events e
        LEFT JOIN impersonation_sessions session ON session.id = e.session_id
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target ON target.id = e.object_id
        ${where.length ? `WHERE ${where.join('\n          AND ')}` : ''}
        ORDER BY e.created_at DESC
        LIMIT ${add(limit)}
    `, values) : { rows: [] }
    const filters = { q, actor: actorFilter, target: targetFilter, action: actionFilter, outcome: outcomeFilter || 'success', method: methodFilter, path: pathFilter, session: sessionFilter, supportSession: sessionFilter, reason: reasonFilter, from: fromFilter, to: toFilter, limit }
    const preparedTimeline = prepareImpersonationTimeline(result.rows)
    const guardrailAudit = await loadImpersonationGuardrailAuditEvents(filters)
    return res.send({
        events: result.rows,
        filters,
        timeline: projectImpersonationTimeline({
            filters,
            prepared: preparedTimeline,
            guardrailRows: guardrailAudit,
            sessionFilter,
        }),
    })
}
