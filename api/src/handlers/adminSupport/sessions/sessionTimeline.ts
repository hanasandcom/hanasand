import run from '#db'
import { toSystemEvent } from '../audit/auditEventProjection.ts'

export const SUPPORT_AUDIT_TIMELINE_SELECT = `SELECT
            e.id,
            e.event_type,
            e.severity,
            e.source,
            e.service,
            e.actor_id,
            actor.name AS actor_name,
            e.object_type,
            e.object_id,
            target_user.name AS target_name,
            e.organization_id,
            organization.name AS organization_name,
            e.subject_id,
            e.request_id,
            e.outcome,
            e.reason,
            e.context,
            e.ip,
            e.user_agent,
            e.created_at
        FROM system_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target_user ON target_user.id = e.object_id
        LEFT JOIN organizations organization ON organization.id = e.organization_id`

export async function loadSupportSessionTimeline(supportSessionId: string) {
    const result = await run(`
        ${SUPPORT_AUDIT_TIMELINE_SELECT}
        WHERE e.subject_id = $1
           OR e.context->>'supportSessionId' = $1
        ORDER BY e.created_at ASC, e.id ASC
        LIMIT 250
    `, [supportSessionId])
    return result.rows.map(toSystemEvent).map(event => event.detail.timelineEvent)
}
