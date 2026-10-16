import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { supportError, supportRequestId, supportText as text } from '#utils/support/adminSupportInput.ts'
import { requireAdminSupport } from '../auth.ts'
import { SUPPORT_AUDIT_TIMELINE_SELECT } from '../sessions/sessionTimeline.ts'
import { supportAuditEventDetailResponse } from './auditEventDetail.ts'
import { toSystemEvent } from './auditEventProjection.ts'

type AuditEventParams = { id: string }

export async function getSystemEvent(req: FastifyRequest<{ Params: AuditEventParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id < 1 || id !== Math.trunc(id)) {
        return res.status(400).send(supportError('invalid_audit_event_id', 'Audit event id must be a positive integer.', {
            field: 'id',
        }))
    }

    const result = await run(`
        SELECT
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
            acknowledgement.acknowledged_at,
            acknowledgement.acknowledged_by,
            acknowledged_actor.name AS acknowledged_by_name,
            e.created_at
        FROM system_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target_user ON target_user.id = e.object_id
        LEFT JOIN organizations organization ON organization.id = e.organization_id
        LEFT JOIN system_event_acknowledgments acknowledgement ON acknowledgement.event_id = e.id
        LEFT JOIN users acknowledged_actor ON acknowledged_actor.id = acknowledgement.acknowledged_by
        WHERE e.id = $1
        LIMIT 1
    `, [id])
    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) {
        return res.status(404).send(supportError('audit_event_not_found', 'Audit event not found.', {
            id,
        }))
    }

    const event = toSystemEvent(row)
    const supportSessionId = event.detail?.actionEvidence?.supportSessionId || ''
    const relatedTimeline = await loadSystemEventRelatedTimeline(event, supportSessionId)
    await recordSystemEvent(req, {
        actionType: 'support.audit_event.inspect',
        actorId: actor.id,
        targetType: 'system_event_event',
        targetId: String(event.id),
        organizationId: event.detail?.organizationId || null,
        entityId: event.detail?.entityId || String(event.id),
        requestId: supportRequestId(req),
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.audit_event.inspect.v1',
            inspectedEventId: Number(event.id),
            inspectedActionType: event.detail?.actionType || null,
            inspectedOutcome: event.detail?.outcome || null,
            inspectedRequestId: event.detail?.requestId || null,
            inspectedEntityId: event.detail?.entityId || null,
            relatedEventIds: relatedTimeline.map(item => item.id),
            redactionRequired: true,
        },
    })
    return res.send({
        event,
        detail: supportAuditEventDetailResponse(event, relatedTimeline, supportSessionId),
    })
}


async function loadSystemEventRelatedTimeline(event: Record<string, any>, supportSessionId = '') {
    const detail = event.detail || {}
    const eventId = Number(event.id)
    const requestId = text(detail.requestId)
    const entityId = text(detail.entityId)
    const values: Array<string | number> = [eventId]
    const where = ['e.id = $1']
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (requestId) where.push(`e.request_id = ${add(requestId)}`)
    if (entityId) where.push(`e.subject_id = ${add(entityId)}`)
    if (supportSessionId) {
        const placeholder = add(supportSessionId)
        where.push(`(e.subject_id = ${placeholder} OR e.context->>'supportSessionId' = ${placeholder})`)
    }

    const result = await run(`
        ${SUPPORT_AUDIT_TIMELINE_SELECT}
        WHERE ${where.join('\n           OR ')}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 50
    `, values)
    return result.rows.map(toSystemEvent).map(row => row.detail.timelineEvent)
}
