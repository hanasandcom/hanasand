import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditActionEvidenceRollup } from './auditEvidenceRollups.ts'

export function supportAuditEntityLinks(input: {
    event: Record<string, any>
    context: Record<string, unknown>
    entityId?: unknown
    supportSessionId?: string
}) {
    const organizationId = text(input.event.organization_id || input.context.organizationId || input.context.targetOrganizationId)
    const targetUserId = text(input.context.targetUserId || (input.event.object_type === 'user' ? input.event.object_id : ''))
    const inviteId = text(input.context.inviteId)
        || (Array.isArray(input.context.inviteIds) ? text(input.context.inviteIds[0]) : '')
        || (input.event.object_type === 'invite' ? text(input.event.subject_id || input.event.object_id) : '')
    const memberId = text(input.context.memberId)
        || (input.event.object_type === 'member' ? text(input.event.subject_id || input.event.object_id) : '')
        || (input.event.object_type === 'user' ? targetUserId : '')
    const alertId = text(input.context.alertId || input.context.alert_id || input.context.dwmAlertId || input.context.alertReferenceId)
        || (input.event.object_type === 'alert' ? text(input.event.subject_id || input.event.object_id) : '')
    const watchlistId = text(input.context.watchlistId || input.context.watchlistItemId || input.context.watchlist_item_id)
        || (input.event.object_type === 'watchlist' ? text(input.event.subject_id || input.event.object_id) : '')
    const webhookId = text(input.context.webhookId || input.context.deliveryId || input.context.webhookDeliveryId)
        || (input.event.object_type === 'webhook' ? text(input.event.subject_id || input.event.object_id) : '')
    const requestId = text(input.event.request_id || input.context.requestId)
    const entityId = text(input.entityId)
    const inspectionParams = new URLSearchParams()
    if (organizationId) inspectionParams.set('org', organizationId)
    if (targetUserId) inspectionParams.set('user', targetUserId)
    if (inviteId) inspectionParams.set('entity', inviteId)
    if (requestId) inspectionParams.set('request', requestId)
    const inspectionQuery = inspectionParams.toString()
    return {
        inspection: inspectionQuery ? `/api/admin/support/inspect?${inspectionQuery}` : null,
        organization: organizationId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}` : null,
        user: targetUserId ? `/api/admin/support/users/${encodeURIComponent(targetUserId)}` : null,
        inviteAction: organizationId && inviteId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions` : null,
        accessRecovery: organizationId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery` : null,
        memberRoleRecovery: organizationId && targetUserId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(targetUserId)}/role-recovery` : null,
        impersonation: targetUserId ? `/api/impersonation/events?target=${encodeURIComponent(targetUserId)}` : null,
        auditEntity: entityId ? `/api/admin/audit-events?entity=${encodeURIComponent(entityId)}` : null,
        member: memberId ? `/api/admin/audit-events?entity=${encodeURIComponent(memberId)}&entityType=member` : null,
        alert: alertId ? `/api/admin/audit-events?entity=${encodeURIComponent(alertId)}&action=alert` : null,
        watchlist: watchlistId ? `/api/admin/audit-events?entity=${encodeURIComponent(watchlistId)}&action=watchlist` : null,
        webhook: webhookId ? `/api/admin/audit-events?entity=${encodeURIComponent(webhookId)}&action=webhook` : null,
        supportSession: input.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}` : null,
        timelineFilters: supportAuditEntityTimelineFilters({
            organizationId,
            targetUserId,
            inviteId,
            memberId,
            alertId,
            watchlistId,
            webhookId,
            requestId,
            entityId,
        }),
    }
}

export function supportAuditEntityTimelineFilters(input: {
    organizationId: string
    targetUserId: string
    inviteId: string
    memberId: string
    alertId: string
    watchlistId: string
    webhookId: string
    requestId: string
    entityId: string
}) {
    return {
        schemaVersion: 'support.audit.entity_timeline_filters.v1',
        organization: input.organizationId ? auditFilterQuery({ org: input.organizationId }) : null,
        user: input.targetUserId ? auditFilterQuery({ target: input.targetUserId }) : null,
        invite: input.inviteId ? auditFilterQuery({ entity: input.inviteId, entityType: 'invite' }) : null,
        member: input.memberId ? auditFilterQuery({ entity: input.memberId, entityType: 'member' }) : null,
        alert: input.alertId ? auditFilterQuery({ entity: input.alertId, action: 'alert' }) : null,
        watchlist: input.watchlistId ? auditFilterQuery({ entity: input.watchlistId, action: 'watchlist' }) : null,
        webhook: input.webhookId ? auditFilterQuery({ entity: input.webhookId, action: 'webhook' }) : null,
        request: input.requestId ? auditFilterQuery({ request: input.requestId }) : null,
        entity: input.entityId ? auditFilterQuery({ entity: input.entityId }) : null,
        redacted: true,
    }
}

export function auditTimelineSummary(timeline: Array<Record<string, any>>) {
    return {
        eventCount: timeline.length,
        actionTypes: uniqueTimelineValues(timeline.map(event => event.actionType)),
        outcomes: uniqueTimelineValues(timeline.map(event => event.outcome)),
        severities: uniqueTimelineValues(timeline.map(event => event.severity)),
        requestIds: uniqueTimelineValues(timeline.map(event => event.requestId)),
        organizationIds: uniqueTimelineValues(timeline.map(event => event.organization?.id)),
        actorIds: uniqueTimelineValues(timeline.map(event => event.actor?.id)),
        entityIds: uniqueTimelineValues(timeline.map(event => event.entity?.id)),
        entityLinkRollup: supportAuditEntityLinkRollup(timeline),
        actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
    }
}

export function supportActivityTimelineSummary(timeline: Array<Record<string, any>>) {
    const events = timeline.filter(event => text(event.action).startsWith('support.') || text(event.action).startsWith('impersonation.'))
    return {
        events,
        eventCount: events.length,
        eventIds: events.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
        blockerCodes: uniqueTimelineValues(events.flatMap(event => [
            event.actionEvidence?.blockers,
            event.context?.blockerCode,
            event.context?.blocker,
        ].flat())),
        outcomes: uniqueTimelineValues(events.map(event => event.outcome)),
        requestIds: uniqueTimelineValues(events.map(event => event.requestId)),
    }
}

export function supportAuditEntityLinkRollup(timeline: Array<Record<string, any>>) {
    const links = timeline.map(event => event.links?.entities || {}).filter(item => item && typeof item === 'object')
    const valuesFor = (key: string) => uniqueTimelineValues(links.map(item => (item as Record<string, unknown>)[key]))
    return {
        schemaVersion: 'support.audit.entity_link_rollup.v1',
        inspection: valuesFor('inspection'),
        organization: valuesFor('organization'),
        user: valuesFor('user'),
        inviteAction: valuesFor('inviteAction'),
        accessRecovery: valuesFor('accessRecovery'),
        memberRoleRecovery: valuesFor('memberRoleRecovery'),
        impersonation: valuesFor('impersonation'),
        auditEntity: valuesFor('auditEntity'),
        member: valuesFor('member'),
        alert: valuesFor('alert'),
        watchlist: valuesFor('watchlist'),
        webhook: valuesFor('webhook'),
        supportSession: valuesFor('supportSession'),
        timelineFilters: uniqueTimelineValues(links.flatMap(item => {
            const filters = (item as Record<string, any>).timelineFilters
            if (!filters || typeof filters !== 'object') return []
            return Object.values(filters).filter(value => typeof value === 'string')
        })),
        redacted: true,
    }
}
