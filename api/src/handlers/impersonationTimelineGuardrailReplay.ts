import { supportSessionIdFromAuditEvent, supportText } from '#utils/support/adminSupportInput.ts'
import { uniqueTimelineValues as uniqueImpersonationValues } from '#utils/support/inspectionPacketShared.ts'

export function supportImpersonationGuardrailAuditReplay(filters: Record<string, unknown>, rows: Array<Record<string, any>>) {
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

export const normalizeAuditScope = (value: unknown) => Array.isArray(value) ? value.map(item => supportText(item)).filter(Boolean) : []
