import run from '#db'
import { supportText } from '#utils/support/adminSupportInput.ts'

export async function loadImpersonationGuardrailAuditEvents(filters: Record<string, unknown>) {
    const where = ['event.event_type = \'impersonation.start\'']
    const values: Array<string | number> = []
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    const q = supportText(filters.q)
    const actor = supportText(filters.actor)
    const target = supportText(filters.target)
    const outcome = supportText(filters.outcome)
    const session = supportText(filters.session || filters.supportSession || filters.supportSessionId)
    const reason = supportText(filters.reason)
    const from = supportText(filters.from)
    const to = supportText(filters.to)
    const limit = Number(filters.limit || 200)

    if (q) {
        const placeholder = add(`%${q}%`)
        where.push(`(
            event.actor_id ILIKE ${placeholder}
            OR actor.name ILIKE ${placeholder}
            OR event.object_id ILIKE ${placeholder}
            OR target.name ILIKE ${placeholder}
            OR event.subject_id ILIKE ${placeholder}
            OR event.request_id ILIKE ${placeholder}
            OR event.reason ILIKE ${placeholder}
            OR event.context::text ILIKE ${placeholder}
        )`)
    }
    if (actor) {
        const placeholder = add(`%${actor}%`)
        where.push('(event.actor_id ILIKE ' + placeholder + ' OR actor.name ILIKE ' + placeholder + ')')
    }
    if (target) {
        const placeholder = add(`%${target}%`)
        where.push('(event.object_id ILIKE ' + placeholder + ' OR target.name ILIKE ' + placeholder + ')')
    }
    if (outcome) where.push(`event.outcome = ${add(outcome)}`)
    if (session) {
        const placeholder = add(`%${session}%`)
        where.push('(event.subject_id ILIKE ' + placeholder + ' OR event.context->>\'supportSessionId\' ILIKE ' + placeholder + ' OR event.context->>\'sessionId\' ILIKE ' + placeholder + ')')
    }
    if (reason) where.push(`event.reason ILIKE ${add(`%${reason}%`)}`)
    if (from && !Number.isNaN(Date.parse(from))) where.push(`event.created_at >= ${add(new Date(from).toISOString())}`)
    if (to && !Number.isNaN(Date.parse(to))) where.push(`event.created_at <= ${add(new Date(to).toISOString())}`)

    const result = await run(`
        SELECT
            event.id,
            event.event_type,
            event.severity,
            event.actor_id,
            actor.name AS actor_name,
            event.object_id,
            target.name AS target_name,
            event.organization_id,
            event.subject_id,
            event.request_id,
            event.outcome,
            event.reason,
            event.context,
            event.created_at
        FROM system_events event
        LEFT JOIN users actor ON actor.id = event.actor_id
        LEFT JOIN users target ON target.id = event.object_id
        WHERE ${where.join('\n          AND ')}
        ORDER BY event.created_at DESC, event.id DESC
        LIMIT ${add(Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 500) : 200)}
    `, values)
    return result.rows as Array<Record<string, any>>
}
