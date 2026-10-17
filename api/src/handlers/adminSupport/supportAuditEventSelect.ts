export const supportAuditEventSelect = `
    SELECT
        event.id,
        event.event_type,
        event.severity,
        event.source,
        event.service,
        event.actor_id,
        actor.name AS actor_name,
        event.object_type,
        event.object_id,
        target_user.name AS target_name,
        event.organization_id,
        organization.name AS organization_name,
        event.subject_id,
        event.request_id,
        event.outcome,
        event.reason,
        event.context,
        event.created_at
    FROM system_events event
    LEFT JOIN users actor ON actor.id = event.actor_id
    LEFT JOIN users target_user ON target_user.id = event.object_id
    LEFT JOIN organizations organization ON organization.id = event.organization_id
`
