import { supportSessionIdFromAuditEvent, supportText } from '#utils/support/adminSupportInput.ts'
import { uniqueTimelineValues as uniqueImpersonationValues } from '#utils/support/inspectionPacketShared.ts'
import { normalizeAuditScope } from './impersonationTimelineGuardrailReplay.ts'
import { impersonationEventsQuery } from './impersonationTimelineQuery.ts'
import type { ImpersonationLifecycleState } from './impersonationTimelineEvents.ts'

export function impersonationCaseReviewPacket(filters: Record<string, unknown>, timeline: Array<Record<string, any>>, guardrailRows: Array<Record<string, any>>, lifecycle: ImpersonationLifecycleState) {
    const { sessionIds, stoppedSessionIds, activeSessionIds, missingReasonEventIds, missingDurationEventIds, expiredSessionIds } = lifecycle
    const actorIds = uniqueImpersonationValues(timeline.map(event => event.actor?.id))
    const targetIds = uniqueImpersonationValues(timeline.map(event => event.target?.id))
    const guardrailEvents = guardrailRows.map(row => {
        const context = row.context && typeof row.context === 'object' ? row.context as Record<string, unknown> : {}
        const supportSessionId = supportSessionIdFromAuditEvent({ context, entityId: row.subject_id })
        return {
            id: Number(row.id),
            actionType: supportText(row.event_type),
            outcome: supportText(row.outcome),
            severity: supportText(row.severity),
            actorId: supportText(row.actor_id),
            targetId: supportText(row.object_id),
            entityId: supportText(row.subject_id),
            requestId: supportText(row.request_id),
            reason: supportText(row.reason),
            supportSessionId,
            blockerCode: supportText(context.blockerCode || context.errorCode),
            durationMinutes: context.durationMinutes ?? null,
            scope: normalizeAuditScope(context.scope),
            createdAt: row.created_at || null,
        }
    })
    const guardrailBlockers = uniqueImpersonationValues(guardrailEvents.map(event => event.blockerCode))
    const deniedGuardrailIds = guardrailEvents
        .filter(event => event.outcome === 'denied' || event.blockerCode)
        .map(event => event.id)
        .filter(id => Number.isFinite(id))
    return {
        schemaVersion: 'support.impersonation.case_review.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        noSilentImpersonation: true,
        supportRoleRequired: true,
        expectedConsumers: ['support', 'case.replay', 'integration'],
        filters,
        summary: {
            lifecycleEventIds: timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
            guardrailEventIds: guardrailEvents.map(event => event.id).filter(id => Number.isFinite(id)),
            deniedGuardrailIds,
            actorIds,
            targetIds,
            sessionIds,
            activeSessionIds,
            stoppedSessionIds: Array.from(stoppedSessionIds),
            expiredSessionIds,
            missingReasonEventIds,
            missingDurationEventIds,
            guardrailBlockers,
            operatorReviewRequired: Boolean(activeSessionIds.length || expiredSessionIds.length || missingReasonEventIds.length || missingDurationEventIds.length || deniedGuardrailIds.length),
        },
        operatorNotes: {
            reasonRequired: true,
            scopeRequired: true,
            durationRequired: true,
            requesterIdentityRequired: true,
            targetIdentityRequired: true,
            reviewFields: ['reason', 'scope', 'durationMinutes', 'supportSessionId', 'targetUserId', 'organizationId', 'auditEventIds'],
            denialReasonCodes: uniqueImpersonationValues([
                ...guardrailBlockers,
                missingReasonEventIds.length ? 'missing_reason_on_impersonation_event' : '',
                missingDurationEventIds.length ? 'missing_duration_on_impersonation_start' : '',
                expiredSessionIds.length ? 'expired_impersonation_session' : '',
            ]),
        },
        timelineEntries: timeline.map(event => ({
            schemaVersion: 'support.impersonation.case_timeline_entry.v1',
            auditEventId: Number(event.id),
            timestamp: event.timestamp || null,
            actionType: event.actionType,
            outcome: event.outcome,
            severity: event.severity,
            actorId: event.actor?.id || null,
            targetId: event.target?.id || null,
            supportSessionId: event.entity?.id || null,
            reason: event.reason || null,
            durationMinutes: event.scope?.durationMinutes ?? null,
            expiresAt: event.scope?.expiresAt || null,
            revokedAt: event.scope?.revokedAt || null,
            reviewRequired: !supportText(event.reason) || !event.scope?.durationMinutes || Boolean(event.scope?.revokedAt),
            links: event.links,
            redacted: true,
        })),
        guardrailEvents,
        replayFilters: {
            lifecycle: impersonationEventsQuery(filters),
            starts: impersonationEventsQuery({ ...filters, action: 'impersonation.start' }),
            stops: impersonationEventsQuery({ ...filters, action: 'impersonation.stop' }),
            denied: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            guardrails: '/api/admin/audit-events?action=impersonation.start&source=admin&service=hanasand-api',
            bySession: sessionIds.map(session => impersonationEventsQuery({ ...filters, session })),
            byTarget: targetIds.map(target => impersonationEventsQuery({ ...filters, target })),
            byReason: filters.reason ? impersonationEventsQuery({ ...filters, reason: filters.reason }) : null,
        },
        nextRoutes: {
            timeline: impersonationEventsQuery(filters),
            start: '/api/impersonation/start',
            auditReplay: '/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api',
            deniedAudit: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            supportSessions: sessionIds.map(session => `/api/admin/support/sessions/${encodeURIComponent(session)}`),
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noSilentImpersonation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        denialStates: [
            'missing_support_reason',
            'invalid_duration',
            'invalid_scope',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_scope_denied',
            'support_session_duration_exceeds_scope',
            'expired_impersonation_session',
            'redaction_required',
        ],
        blockers: [
            timeline.length ? '' : 'lifecycle_events_unavailable',
            missingReasonEventIds.length ? 'missing_reason_on_impersonation_event' : '',
            missingDurationEventIds.length ? 'missing_duration_on_impersonation_start' : '',
            expiredSessionIds.length ? 'expired_impersonation_session' : '',
            deniedGuardrailIds.length ? 'denied_guardrail_audit_events_present' : '',
        ].filter(Boolean),
        copyText: [
            'Support impersonation case review',
            `Lifecycle replay: ${impersonationEventsQuery(filters)}`,
            `Sessions: ${sessionIds.join(', ') || 'none'}`,
            `Denied guardrails: ${deniedGuardrailIds.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
