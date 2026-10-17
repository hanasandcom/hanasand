import { supportText } from '#utils/support/adminSupportInput.ts'
import { uniqueTimelineValues as uniqueImpersonationValues } from '#utils/support/inspectionPacketShared.ts'

export function toImpersonationTimelineEvent(row: Record<string, any>) {
    const actionType = String(row.path || '').includes('/stop') ? 'impersonation.stop' : 'impersonation.start'
    const id = Number(row.id)
    const durationMinutes = impersonationSessionDurationMinutes(row.session_created_at, row.session_expires_at)
    return {
        schemaVersion: 'support.impersonation.timeline_event.v1',
        id,
        timestamp: row.created_at,
        actionType,
        severity: actionType === 'impersonation.start' ? 'warning' : 'notice',
        outcome: 'success',
        actor: {
            id: row.actor_id,
            name: row.actor_name || null,
        },
        target: {
            type: 'user',
            id: row.object_id,
            name: row.target_name || null,
        },
        entity: {
            type: 'impersonation_session',
            id: row.session_id || null,
        },
        method: row.method,
        path: row.path,
        reason: row.session_reason || '',
        scope: {
            durationMinutes,
            expiresAt: row.session_expires_at || null,
            revokedAt: row.session_revoked_at || null,
            supportSessionRequired: true,
            reasonRequired: true,
            auditRequired: true,
        },
        links: {
            detail: `/api/impersonation/events?session=${encodeURIComponent(String(row.session_id || ''))}`,
            audit: `/api/admin/audit-events?action=${encodeURIComponent(actionType)}&entity=${encodeURIComponent(String(row.session_id || ''))}&source=admin&service=hanasand-api`,
            request: `/api/admin/audit-events?action=${encodeURIComponent(actionType)}&entity=${encodeURIComponent(String(row.session_id || ''))}&reason=${encodeURIComponent(String(row.session_reason || ''))}&source=admin&service=hanasand-api`,
        },
        copyText: `${row.created_at} ${actionType} actor=${row.actor_id} target=${row.object_id} session=${row.session_id || ''} duration=${durationMinutes ?? ''} reason=${row.session_reason || ''}`,
    }
}

function impersonationSessionDurationMinutes(createdAt: unknown, expiresAt: unknown) {
    const created = Date.parse(String(createdAt || ''))
    const expires = Date.parse(String(expiresAt || ''))
    if (Number.isNaN(created) || Number.isNaN(expires) || expires <= created) return null
    return Math.round((expires - created) / 60000)
}

export function impersonationTimelineSummary(timeline: Array<Record<string, any>>) {
    return {
        eventCount: timeline.length,
        actionTypes: uniqueImpersonationValues(timeline.map(event => event.actionType)),
        actorIds: uniqueImpersonationValues(timeline.map(event => event.actor?.id)),
        targetIds: uniqueImpersonationValues(timeline.map(event => event.target?.id)),
        sessionIds: uniqueImpersonationValues(timeline.map(event => event.entity?.id)),
        outcomes: uniqueImpersonationValues(timeline.map(event => event.outcome)),
    }
}


export function impersonationLifecycleState(timeline: Array<Record<string, any>>) {
    const now = Date.now()
    const startEvents = timeline.filter(event => event.actionType === 'impersonation.start')
    const stopEvents = timeline.filter(event => event.actionType === 'impersonation.stop' || event.scope?.revokedAt)
    const stoppedSessionIds = new Set(stopEvents.map(event => supportText(event.entity?.id)).filter(Boolean))
    const activeSessionIds = startEvents
        .map(event => supportText(event.entity?.id))
        .filter(sessionId => sessionId && !stoppedSessionIds.has(sessionId))
    const missingReasonEventIds = timeline
        .filter(event => !supportText(event.reason))
        .map(event => Number(event.id))
        .filter(id => Number.isFinite(id))
    const missingDurationEventIds = startEvents
        .filter(event => !event.scope?.durationMinutes)
        .map(event => Number(event.id))
        .filter(id => Number.isFinite(id))
    const expiredSessionIds = startEvents
        .filter(event => {
            const expires = Date.parse(String(event.scope?.expiresAt || ''))
            return !Number.isNaN(expires) && expires <= now && !stoppedSessionIds.has(supportText(event.entity?.id))
        })
        .map(event => supportText(event.entity?.id))
        .filter(Boolean)

    return {
        sessionIds: uniqueImpersonationValues(timeline.map(event => event.entity?.id)),
        startEvents,
        stopEvents,
        stoppedSessionIds,
        activeSessionIds,
        missingReasonEventIds,
        missingDurationEventIds,
        expiredSessionIds,
    }
}

export type ImpersonationLifecycleState = ReturnType<typeof impersonationLifecycleState>
