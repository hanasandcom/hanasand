import { supportSessionIdFromAuditEvent, supportText } from '#utils/support/adminSupportInput.ts'

function supportImpersonationGuardrailAuditReplay(filters: Record<string, unknown>, rows: Array<Record<string, any>>) {
    const events = rows.map((row) => {
        const context = row.context as Record<string, any> || {}
        const supportSessionId = supportSessionIdFromAuditEvent({ context, entityId: row.subject_id })
        return {
            schemaVersion: 'support.impersonation.guardrail_audit_event.v1',
            id: Number(row.id),
            timestamp: row.created_at || null,
            actionType: row.event_type || 'impersonation.start',
            severity: row.severity || null,
            outcome: row.outcome || null,
            actor: {
                id: row.actor_id || null,
                name: row.actor_name || null,
            },
            target: {
                type: 'user',
                id: row.object_id || null,
                name: row.target_name || null,
            },
            organizationId: row.organization_id || context.organizationId || null,
            entityId: row.subject_id || null,
            requestId: row.request_id || context.requestId || null,
            reasonPresent: Boolean(supportText(row.reason)),
            supportSessionId: supportSessionId || null,
            durationMinutes: context.durationMinutes ?? null,
            expiresAt: context.expiresAt || null,
            scope: normalizeAuditScope(context.scope),
            blockerCode: context.blockerCode || null,
            noSilentImpersonation: context.noSilentImpersonation === true,
            redacted: true,
            links: {
                detail: `/api/admin/audit-events/${encodeURIComponent(String(row.id))}`,
                request: row.request_id ? `/api/admin/audit-events?request=${encodeURIComponent(String(row.request_id))}&action=impersonation.start&source=admin&service=hanasand-api` : null,
                supportSession: supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(supportSessionId)}` : null,
            },
        }
    })
    const eventIds = events.map(event => event.id).filter(id => Number.isFinite(id))
    const blockerCodes = uniqueImpersonationValues(events.map(event => event.blockerCode))
    const supportSessionIds = uniqueImpersonationValues(events.map(event => event.supportSessionId))
    const outcomes = uniqueImpersonationValues(events.map(event => event.outcome))
    return {
        schemaVersion: 'support.impersonation.guardrail_audit_replay.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noSilentImpersonation: true,
        supportRoleRequired: true,
        filters,
        eventIds,
        outcomes,
        blockerCodes,
        supportSessionIds,
        events,
        replayFilters: {
            current: `/api/admin/audit-events?action=impersonation.start&source=admin&service=hanasand-api${filters.outcome ? `&outcome=${encodeURIComponent(String(filters.outcome))}` : ''}`,
            denied: '/api/admin/audit-events?action=impersonation.start&outcome=denied&source=admin&service=hanasand-api',
            bySupportSession: supportSessionIds.map(session => `/api/admin/audit-events?action=impersonation.start&entity=${encodeURIComponent(session)}&source=admin&service=hanasand-api`),
            byBlocker: blockerCodes.map(blocker => `/api/admin/audit-events?action=impersonation.start&blocker=${encodeURIComponent(blocker)}&source=admin&service=hanasand-api`),
        },
        denialCases: [
            'missing_support_reason',
            'invalid_duration',
            'invalid_scope',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'support_session_duration_exceeds_scope',
        ],
        blockers: [
            events.length ? '' : 'guardrail_audit_unavailable',
            events.some(event => event.outcome === 'denied') ? '' : 'denied_guardrail_not_matched',
        ].filter(Boolean),
        copyText: [
            'Support impersonation guardrail audit replay',
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Blockers: ${blockerCodes.join(', ') || 'none'}`,
            `Sessions: ${supportSessionIds.join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function toImpersonationTimelineEvent(row: Record<string, any>) {
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

function impersonationTimelineSummary(timeline: Array<Record<string, any>>) {
    return {
        eventCount: timeline.length,
        actionTypes: uniqueImpersonationValues(timeline.map(event => event.actionType)),
        actorIds: uniqueImpersonationValues(timeline.map(event => event.actor?.id)),
        targetIds: uniqueImpersonationValues(timeline.map(event => event.target?.id)),
        sessionIds: uniqueImpersonationValues(timeline.map(event => event.entity?.id)),
        outcomes: uniqueImpersonationValues(timeline.map(event => event.outcome)),
    }
}

function uniqueImpersonationValues(values: unknown[]) {
    return Array.from(new Set(values.map(value => supportText(value)).filter(Boolean))).slice(0, 50)
}

function impersonationLifecycleState(timeline: Array<Record<string, any>>) {
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

type ImpersonationLifecycleState = ReturnType<typeof impersonationLifecycleState>

function impersonationTimelineFilterContract(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    return {
        schemaVersion: 'support.impersonation.timeline_filter_contract.v1',
        filters,
        supportedFilters: ['q', 'actor', 'target', 'action', 'outcome', 'method', 'path', 'session', 'supportSession', 'supportSessionId', 'reason', 'from', 'to', 'limit'],
        filterReadiness: impersonationTimelineFilterReadiness(filters, timeline),
        lifecycleStorage: 'impersonation_events',
        auditStorage: 'system_events',
        eventCount: timeline.length,
        redacted: true,
        unavailableFilters: [
            {
                filter: 'requestId',
                reason: 'Lifecycle rows do not store request ids; use admin audit events for request correlation.',
                route: '/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api',
            },
            {
                filter: 'deniedOutcome',
                reason: 'Denied impersonation attempts are stored as structured admin audit events.',
                route: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            },
        ],
        replay: {
            lifecycle: impersonationEventsQuery(filters),
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${filters.session ? `&entity=${encodeURIComponent(String(filters.session))}` : ''}`,
        },
        copyText: [
            'Impersonation timeline filter contract',
            `Lifecycle replay: ${impersonationEventsQuery(filters)}`,
            'Denied attempts: /api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
        ].join('\n'),
    }
}

function impersonationTimelineFilterReadiness(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const filterText = (key: string) => supportText(filters[key])
    const appliedFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => supportText(value)))
    const targetFilters = ['actor', 'target', 'session', 'supportSession', 'reason']
        .filter(key => filterText(key))
    const actionFilters = ['action', 'outcome', 'method', 'path']
        .filter(key => filterText(key))
    const from = filterText('from')
    const to = filterText('to')
    const timeRangeValid = (!from || !Number.isNaN(Date.parse(from))) && (!to || !Number.isNaN(Date.parse(to)))
    const targetBounded = Boolean(targetFilters.length)
    return {
        schemaVersion: 'support.impersonation.timeline_filter_readiness.v1',
        appliedFilters,
        targetBounded,
        targetFilters,
        actionFilters,
        timeRange: {
            from: from || null,
            to: to || null,
            valid: timeRangeValid,
        },
        supportedAliases: {
            actor: ['actor'],
            target: ['target'],
            session: ['session', 'supportSession', 'supportSessionId'],
            reason: ['reason'],
        },
        replay: {
            lifecycle: impersonationEventsQuery(filters),
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${filterText('session') ? `&entity=${encodeURIComponent(filterText('session'))}` : ''}`,
            denied: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
        },
        blockers: [
            timeRangeValid ? '' : 'invalid_time_range',
            !targetBounded && (actionFilters.length || from || to) ? 'overbroad_impersonation_timeline_filter' : '',
            timeline.length ? '' : 'lifecycle_events_unavailable',
        ].filter(Boolean),
        redacted: true,
    }
}

function impersonationTimelineDecisionPacket(filters: Record<string, unknown>, timeline: Array<Record<string, any>>, lifecycle: ImpersonationLifecycleState) {
    const { startEvents, stopEvents, activeSessionIds, missingReasonEventIds, missingDurationEventIds } = lifecycle
    const blockers = [
        timeline.length ? '' : 'lifecycle_events_unavailable',
        missingReasonEventIds.length ? 'missing_reason_on_impersonation_event' : '',
        missingDurationEventIds.length ? 'missing_duration_on_impersonation_start' : '',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.impersonation.decision_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noSilentImpersonation: true,
        supportRoleRequired: true,
        requiredOperatorInputs: {
            reason: true,
            context: true,
            scope: true,
            durationMinutes: true,
            targetUser: true,
            organizationId: true,
            supportSessionId: true,
        },
        lifecycle: {
            eventCount: timeline.length,
            startEventIds: startEvents.map(event => event.id),
            stopEventIds: stopEvents.filter(event => event.actionType === 'impersonation.stop').map(event => event.id),
            activeSessionIds,
            missingReasonEventIds,
            missingDurationEventIds,
        },
        auditReplay: {
            lifecycle: impersonationEventsQuery(filters),
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${filters.session ? `&entity=${encodeURIComponent(String(filters.session))}` : ''}`,
            denied: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            supportSession: filters.session ? `/api/admin/support/sessions/${encodeURIComponent(String(filters.session))}` : null,
        },
        nextActions: [
            activeSessionIds.length ? {
                action: 'review_active_impersonation_session',
                route: impersonationEventsQuery({ ...filters, session: activeSessionIds[0] }),
            } : null,
            missingReasonEventIds.length || missingDurationEventIds.length ? {
                action: 'review_system_event_denials',
                route: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            } : null,
        ].filter(Boolean),
        blockers,
        copyText: [
            'Support impersonation decision packet',
            `Lifecycle replay: ${impersonationEventsQuery(filters)}`,
            `Events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
            `Active sessions: ${activeSessionIds.join(', ') || 'none'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function impersonationCaseReviewPacket(filters: Record<string, unknown>, timeline: Array<Record<string, any>>, guardrailRows: Array<Record<string, any>>, lifecycle: ImpersonationLifecycleState) {
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

const normalizeAuditScope = (value: unknown) => Array.isArray(value) ? value.map(item => supportText(item)).filter(Boolean) : []

function impersonationLifecycleReceipt(filters: Record<string, unknown>, timeline: Array<Record<string, any>>, lifecycle: ImpersonationLifecycleState) {
    const { sessionIds, startEvents, stopEvents, stoppedSessionIds, activeSessionIds, missingReasonEventIds, missingDurationEventIds, expiredSessionIds } = lifecycle
    return {
        schemaVersion: 'support.impersonation.lifecycle_receipt.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noSilentImpersonation: true,
        supportRoleRequired: true,
        reasonRequired: true,
        durationRequired: true,
        scopeRequired: true,
        supportSessionRequired: true,
        filters,
        actorIds: uniqueImpersonationValues(timeline.map(event => event.actor?.id)),
        targetIds: uniqueImpersonationValues(timeline.map(event => event.target?.id)),
        sessionIds,
        requestId: null,
        outcome: timeline.length ? 'success' : 'failed',
        severity: activeSessionIds.length || expiredSessionIds.length ? 'warning' : 'notice',
        auditEventIds: timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
        lifecycle: {
            startEventIds: startEvents.map(event => event.id),
            stopEventIds: stopEvents.map(event => event.id),
            activeSessionIds,
            stoppedSessionIds: Array.from(stoppedSessionIds),
            expiredSessionIds,
            missingReasonEventIds,
            missingDurationEventIds,
        },
        replayFilters: {
            current: impersonationEventsQuery(filters),
            starts: impersonationEventsQuery({ ...filters, action: 'impersonation.start' }),
            stops: impersonationEventsQuery({ ...filters, action: 'impersonation.stop' }),
            active: activeSessionIds.map(session => impersonationEventsQuery({ ...filters, session })),
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${filters.session ? `&entity=${encodeURIComponent(String(filters.session))}` : ''}`,
            denied: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            bySession: sessionIds.map(session => ({
                session,
                lifecycle: impersonationEventsQuery({ ...filters, session }),
                audit: `/api/admin/audit-events?action=impersonation&entity=${encodeURIComponent(session)}&source=admin&service=hanasand-api`,
            })),
        },
        receiptSchemas: [
            'support.impersonation.lifecycle_receipt.v1',
            'support.impersonation.request.v1',
            'support.impersonation.stop.v1',
            'support.impersonation.decision_packet.v1',
            'support.impersonation.timeline_filter_contract.v1',
        ],
        nextRoutes: {
            lifecycle: impersonationEventsQuery(filters),
            deniedAudit: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
            supportSession: filters.session ? `/api/admin/support/sessions/${encodeURIComponent(String(filters.session))}` : null,
            activeSessions: activeSessionIds.map(session => impersonationEventsQuery({ session })),
        },
        denialCases: [
            'impersonation_support_required',
            'missing_target_user',
            'missing_support_reason',
            'invalid_duration',
            'invalid_scope',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
        ],
        blockers: [
            timeline.length ? '' : 'lifecycle_events_unavailable',
            missingReasonEventIds.length ? 'missing_reason_on_impersonation_event' : '',
            missingDurationEventIds.length ? 'missing_duration_on_impersonation_start' : '',
            expiredSessionIds.length ? 'expired_impersonation_session' : '',
        ].filter(Boolean),
        copyText: [
            'Support impersonation lifecycle receipt',
            `Sessions: ${sessionIds.join(', ') || 'none'}`,
            `Active: ${activeSessionIds.join(', ') || 'none'}`,
            `Expired: ${expiredSessionIds.join(', ') || 'none'}`,
            `Replay: ${impersonationEventsQuery(filters)}`,
        ].join('\n'),
    }
}

function impersonationEventsQuery(filters: Record<string, unknown>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue
        params.set(key, String(value))
    }
    const query = params.toString()
    return `/api/impersonation/events${query ? `?${query}` : ''}`
}

type PreparedImpersonationTimeline = {
    timeline: Array<Record<string, any>>
    lifecycleState: ImpersonationLifecycleState
}

export function prepareImpersonationTimeline(rows: Array<Record<string, any>>): PreparedImpersonationTimeline {
    const timeline = rows.map(toImpersonationTimelineEvent)
    const lifecycleState = impersonationLifecycleState(timeline)
    return { timeline, lifecycleState }
}

export function projectImpersonationTimeline(input: {
    filters: Record<string, unknown>
    prepared: PreparedImpersonationTimeline
    guardrailRows: Array<Record<string, any>>
    sessionFilter: string
}) {
    const { filters, prepared, guardrailRows, sessionFilter } = input
    const { timeline, lifecycleState } = prepared
    return {
        schemaVersion: 'support.impersonation.timeline.v1',
        filters,
        eventIds: timeline.map(event => event.id),
        summary: impersonationTimelineSummary(timeline),
        filterContract: impersonationTimelineFilterContract(filters, timeline),
        decisionPacket: impersonationTimelineDecisionPacket(filters, timeline, lifecycleState),
        lifecycleReceipt: impersonationLifecycleReceipt(filters, timeline, lifecycleState),
        guardrailReplay: supportImpersonationGuardrailAuditReplay(filters, guardrailRows),
        caseReview: impersonationCaseReviewPacket(filters, timeline, guardrailRows, lifecycleState),
        events: timeline,
        redacted: true,
        links: {
            audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${sessionFilter ? `&entity=${encodeURIComponent(sessionFilter)}` : ''}`,
            details: timeline.map(event => event.links.detail),
        },
        copyText: timeline.map(event => event.copyText).join('\n'),
    }
}
