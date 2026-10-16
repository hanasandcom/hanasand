import { supportSessionIdFromAuditEvent, supportText as text } from '#utils/support/adminSupportInput.ts'
import { redactAuditValue } from '#utils/systemEvent.ts'
import { supportAuditActionEvidence } from './auditActionEvidence.ts'
import { supportAuditEntityLinks } from './auditEntityTimeline.ts'

export function toSupportAuditTimelineEvent(row: Record<string, unknown>) {
    const { event, context, beforeAfter, id, entityId, actionEvidence, links } = supportAuditEventProjection(row)
    return {
        id,
        actor: {
            id: event.actor_id,
            name: event.actor_name || null,
        },
        target: {
            type: event.object_type || null,
            id: event.object_id || null,
            name: event.target_name || null,
        },
        entityType: event.object_type || 'system_event_event',
        entityId,
        organizationId: event.organization_id || null,
        organizationName: event.organization_name || null,
        action: event.event_type,
        outcome: event.outcome,
        severity: event.severity,
        requestId: event.request_id || null,
        reason: event.reason || '',
        before: beforeAfter.before,
        after: beforeAfter.after,
        actionEvidence,
        context,
        links,
        createdAt: event.created_at,
        copyText: `${event.created_at} ${event.severity}/${event.outcome} ${event.event_type} actor=${event.actor_id} entity=${event.subject_id || event.object_id || ''} request=${event.request_id || ''}`,
    }
}

export function toSystemEvent(row: Record<string, unknown>): Record<string, any> {
    const { event: sourceEvent, context, beforeAfter, id, entityId, actionEvidence, links } = supportAuditEventProjection(row)
    const event: Record<string, any> = { ...sourceEvent, target_name: text(context.targetName) || row.target_name || null }
    const timelineEvent = {
        schemaVersion: 'admin.audit.timeline_event.v1',
        id,
        timestamp: event.created_at,
        actionType: event.event_type,
        severity: event.severity,
        outcome: event.outcome,
        source: event.source,
        service: event.service,
        actor: {
            id: event.actor_id,
            name: event.actor_name || null,
        },
        target: {
            type: event.object_type || null,
            id: event.object_id || null,
            name: event.target_name || null,
        },
        organization: {
            id: event.organization_id || null,
            name: event.organization_name || null,
        },
        entity: {
            id: entityId,
            type: event.object_type || 'system_event_event',
        },
        requestId: event.request_id || null,
        reason: event.reason || '',
        scope: auditEventScope(context),
        before: beforeAfter.before,
        after: beforeAfter.after,
        actionEvidence,
        context,
        links,
    }
    return {
        ...event,
        context,
        detail: {
            schemaVersion: 'admin.audit.event_detail.v1',
            actionType: event.event_type,
            source: event.source,
            service: event.service,
            severity: event.severity,
            outcome: event.outcome,
            actorId: event.actor_id,
            targetType: event.object_type,
            targetId: event.object_id,
            organizationId: event.organization_id,
            entityId: event.subject_id,
            requestId: event.request_id,
            reason: event.reason,
            before: beforeAfter.before,
            after: beforeAfter.after,
            context,
            actionEvidence,
            timelineEvent,
            redactedSummary: {
                schemaVersion: 'support.audit.redacted_summary.v1',
                eventId: Number(event.id),
                actionType: event.event_type,
                outcome: event.outcome,
                severity: event.severity,
                actorId: event.actor_id,
                targetId: event.object_id || null,
                entityId: event.subject_id || null,
                requestId: event.request_id || null,
                correlationId: text(context.correlationId) || event.request_id || null,
                idempotencyKey: text(context.idempotencyKey) || null,
                reasonPresent: Boolean(event.reason),
                contextRedacted: true,
                detailRoute: `/api/admin/audit-events/${encodeURIComponent(String(event.id))}`,
                supportActionEvidence: actionEvidence,
                relatedEntityLinks: timelineEvent.links.entities,
            },
            copyText: `${event.created_at} ${event.severity}/${event.outcome} ${event.event_type} actor=${event.actor_id} target=${event.object_id || ''} org=${event.organization_id || ''} request=${event.request_id || ''} reason=${event.reason || ''}`,
        },
    }
}

export function supportAuditEventProjection(row: Record<string, unknown>) {
    const event = row as Record<string, any>
    const originalContext = event.context && typeof event.context === 'object' ? event.context : {}
    const context = redactAuditValue(originalContext) as Record<string, unknown>
    const beforeAfter = auditBeforeAfter(context)
    const id = Number(event.id)
    const entityId = event.subject_id || event.object_id || event.organization_id || null
    const supportSessionId = supportSessionIdFromAuditEvent({ context: originalContext, entityId })
    const actionEvidence = supportAuditActionEvidence({ event, context, entityId, supportSessionId })
    const links = {
        detail: `/api/admin/audit-events/${encodeURIComponent(String(id))}`,
        request: event.request_id ? `/api/admin/audit-events?request=${encodeURIComponent(String(event.request_id))}` : null,
        entity: entityId ? `/api/admin/audit-events?entity=${encodeURIComponent(String(entityId))}` : null,
        supportSession: supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(supportSessionId)}` : null,
        entities: supportAuditEntityLinks({ event, context, entityId, supportSessionId }),
    }
    return { event, context, beforeAfter, id, entityId, supportSessionId, actionEvidence, links }
}

export function auditEventScope(context: Record<string, unknown>) {
    return {
        durationMinutes: context.durationMinutes ?? null,
        scope: context.scope ?? null,
        targetUserId: context.targetUserId ?? null,
        organizationId: context.organizationId ?? null,
        expiresAt: context.expiresAt ?? null,
        requestId: context.requestId ?? null,
        supportContext: context.supportContext ?? null,
    }
}

export function auditBeforeAfter(context: Record<string, unknown>) {
    const before = context.before || context.previous || pickPrefixedContext(context, 'previous')
    const after = context.after || context.next || pickPrefixedContext(context, 'new')
    return {
        before: isPlainObject(before) && Object.keys(before).length ? before : null,
        after: isPlainObject(after) && Object.keys(after).length ? after : null,
    }
}

export function pickPrefixedContext(context: Record<string, unknown>, prefix: string) {
    return Object.fromEntries(Object.entries(context).filter(([key]) => key.toLowerCase().startsWith(prefix)))
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
