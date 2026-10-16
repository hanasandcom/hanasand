import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'
export function supportSessionReplayReceipt(input: {
    supportSession: string
    sessionState: Record<string, any> | null
    actorId: string
    requestId: string
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    receiptReplayPacket: Record<string, any>
    authorization: Record<string, any>
}) {
    const sessionTimeline = input.supportSession
        ? input.timeline.filter(event => {
            const contextSession = text(event.context?.supportSessionId)
            const entityId = text(event.entityId || event.entity?.id)
            return contextSession === input.supportSession || entityId === input.supportSession
        })
        : []
    const eventIds = sessionTimeline.map(event => Number(event.id)).filter(id => Number.isFinite(id))
    const status = text(input.sessionState?.status) || (input.supportSession ? 'unavailable' : 'not_scoped')
    const actionValues = uniqueTimelineValues(sessionTimeline.map(event => event.action || event.actionType))
    const outcomeValues = uniqueTimelineValues(sessionTimeline.map(event => event.outcome))
    const sessionFilter = {
        ...input.timelineFilter,
        supportSession: input.supportSession,
        entity: input.supportSession || input.timelineFilter.entity,
    }
    const expired = status === 'expired'
    const revoked = status === 'revoked'
    return {
        schemaVersion: 'support.scoped_session.replay_receipt.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        supportSessionRequired: true,
        supportSessionId: input.supportSession || null,
        status,
        actorId: input.actorId,
        sessionActorId: input.sessionState?.actorId || null,
        targetType: input.sessionState?.targetUserId ? 'user' : input.sessionState?.organizationId ? 'organization' : 'support_session',
        targetId: input.sessionState?.targetUserId || input.sessionState?.organizationId || input.supportSession || null,
        organizationId: input.sessionState?.organizationId || null,
        targetUserId: input.sessionState?.targetUserId || null,
        entityId: input.supportSession || null,
        requestId: input.requestId,
        sessionRequestId: input.sessionState?.requestId || null,
        reason: input.sessionState?.reason || null,
        reasonPresent: Boolean(input.sessionState?.reason),
        allowedActions: Array.isArray(input.sessionState?.allowedActions) ? input.sessionState?.allowedActions : [],
        scope: Array.isArray(input.sessionState?.scope) ? input.sessionState?.scope : [],
        durationMinutes: input.sessionState?.durationMinutes || null,
        expiresAt: input.sessionState?.expiresAt || null,
        revokedBy: input.sessionState?.revokedBy || null,
        revokedAt: input.sessionState?.revokedAt || null,
        outcome: input.supportSession && input.sessionState && !expired && !revoked ? 'success' : 'denied',
        severity: expired || revoked ? 'warning' : 'notice',
        auditEventIds: eventIds,
        actions: actionValues,
        outcomes: outcomeValues,
        replayFilters: {
            current: input.supportSession ? auditFilterQuery(sessionFilter) : null,
            lifecycle: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, action: 'support.session', source: 'admin', service: 'hanasand-api' }) : null,
            create: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, action: 'support.session.create' }) : null,
            revoke: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, action: 'support.session.revoke' }) : null,
            denied: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, outcome: 'denied', source: 'admin', service: 'hanasand-api' }) : null,
            expired: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, blocker: 'support_session_expired' }) : null,
            byAction: actionValues.map(action => auditFilterQuery({ supportSession: input.supportSession, action })),
            byOutcome: outcomeValues.map(outcome => auditFilterQuery({ supportSession: input.supportSession, outcome })),
        },
        receiptSchemas: [
            'support.scoped_session.replay_receipt.v1',
            'support.scoped_session.lifecycle_receipt.v1',
            'support.inspection.receipt_replay_packet.v1',
            'support.audit.filter_contract.v1',
            'support.audit.support_workflow_packet.v1',
        ],
        replayPacket: {
            schemaVersion: input.receiptReplayPacket.schemaVersion || null,
            receiptEventIds: Array.isArray(input.receiptReplayPacket.receiptEventIds) ? input.receiptReplayPacket.receiptEventIds : [],
            blockers: Array.isArray(input.receiptReplayPacket.blockers) ? input.receiptReplayPacket.blockers : [],
        },
        authorization: {
            supportSessionScoped: Boolean(input.authorization.supportSessionScoped),
            noCrossOrgLeakage: Boolean(input.authorization.noCrossOrgLeakage),
            blockers: Array.isArray(input.authorization.blockers) ? input.authorization.blockers : [],
        },
        nextRoutes: {
            inspect: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
            revoke: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}/revoke` : null,
            audit: input.supportSession ? auditFilterQuery(sessionFilter) : null,
            deniedAudit: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, outcome: 'denied' }) : null,
            details: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        },
        denialCases: [
            'support_session_not_found',
            'support_session_expired',
            'support_session_revoked',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'missing_support_reason',
            'missing_receipt_audit_events',
        ],
        blockers: uniqueTimelineValues([
            input.supportSession ? '' : 'missing_support_session',
            input.sessionState ? '' : 'support_session_not_found',
            expired ? 'support_session_expired' : '',
            revoked ? 'support_session_revoked' : '',
            input.sessionState?.reason ? '' : 'missing_support_reason',
            eventIds.length ? '' : 'missing_receipt_audit_events',
            ...(Array.isArray(input.authorization.blockers) ? input.authorization.blockers : []),
        ]),
        copyText: [
            `Support session replay ${input.supportSession || '*'}`,
            `Status: ${status}`,
            `Request: ${input.sessionState?.requestId || input.requestId}`,
            `Actions: ${actionValues.join(', ') || 'none'}`,
            `Audit events: ${eventIds.join(', ') || 'none'}`,
            `Replay: ${input.supportSession ? auditFilterQuery(sessionFilter) : 'missing support session'}`,
        ].join('\n'),
    }
}
