import { auditFilterQuery, supportInspectionRequestIds, uniqueTimelineValues, type SupportInspectionPacket, type SupportTimelineFilter } from './inspectionPacketShared.ts'
import { supportText as text } from './adminSupportInput.ts'

export function supportInspectionAuditDetailPacket(input: {
    org: string
    user: string
    email: string
    request: string
    supportSession: string
    organizationIds: string[]
    memberships: Array<Record<string, any>>
    invites: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}): SupportInspectionPacket {
    const detailEvents = input.timeline.slice(0, 25).map(event => ({
        id: event.id || null,
        detailRoute: event.id ? `/api/admin/audit-events/${encodeURIComponent(String(event.id))}` : null,
        actionType: event.actionType || null,
        outcome: event.outcome || null,
        severity: event.severity || null,
        requestId: event.requestId || null,
        organizationId: event.organizationId || null,
        targetId: event.targetId || null,
        entityId: event.entityId || null,
        createdAt: event.createdAt || null,
        reasonPresent: Boolean(text(event.reason)),
        links: event.links || {},
    }))
    const memberEntityIds = uniqueTimelineValues(input.memberships.map(member => member.id || member.user_id))
    const inviteEntityIds = uniqueTimelineValues(input.invites.map(invite => invite.id))
    const targetUserIds = uniqueTimelineValues([
        input.user,
        ...input.memberships.map(member => member.user_id),
        ...input.invites.map(invite => invite.user_id),
    ])
    const requestIds = supportInspectionRequestIds(input.request, input.timeline)
    return {
        schemaVersion: 'support.inspection.audit_detail_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        detailEvents,
        detailRoutes: detailEvents.map(event => event.detailRoute).filter(Boolean),
        replayFilters: {
            current: auditFilterQuery(input.timelineFilter),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            request: requestIds.map(requestId => auditFilterQuery({ request: requestId })),
            organization: input.organizationIds.map(organizationId => auditFilterQuery({ org: organizationId })),
            user: targetUserIds.map(userId => auditFilterQuery({ target: userId })),
            member: memberEntityIds.map(entityId => auditFilterQuery({ entity: entityId, entityType: 'member' })),
            invite: inviteEntityIds.map(entityId => auditFilterQuery({ entity: entityId, entityType: 'invite' })),
            supportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession }) : null,
        },
        supportActionRequirements: {
            inviteAssistance: ['reason', 'context', 'scope', 'expiresAt', 'idempotencyKey'],
            accessRecovery: ['reason', 'context', 'scope', 'expiresAt', 'requestId'],
            memberRoleRecovery: ['reason', 'context', 'scope', 'role', 'requestId'],
            impersonation: ['reason', 'context', 'scope', 'durationMinutes', 'targetUserId', 'organizationId'],
        },
        guardrails: {
            supportRoleRequired: true,
            noCrossOrgLeakage: true,
            reasonRequiredForSensitiveActions: true,
            detailRetrievalRequiresSupport: true,
            redactionRequired: true,
        },
        blockers: uniqueTimelineValues([
            detailEvents.length ? '' : 'missing_audit_events',
            input.organizationIds.length || input.supportSession ? '' : 'missing_org_or_support_session_scope',
            ...detailEvents.map(event => event.reasonPresent ? '' : 'missing_reason_on_source_event'),
        ]),
        copyText: [
            `Support inspection audit details org=${input.organizationIds.join(',') || '*'} user=${input.user || '*'} request=${input.request || '*'}`,
            `Detail routes: ${detailEvents.map(event => event.detailRoute).filter(Boolean).join(', ') || 'none'}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
            'Redacted: true',
        ].join('\n'),
    }
}
