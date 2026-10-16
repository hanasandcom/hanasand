import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'

export function supportInspectionReplayExportPacket(input: {
    actorId: string
    org: string
    user: string
    email: string
    request: string
    entity: string
    entityType: string
    supportSession: string
    organizationIds: string[]
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    accessRecoveryPlan: Record<string, any>
    approvalDecisionPacket: Record<string, any>
    receiptReplayPacket: Record<string, any>
    sessionReplayReceipt: Record<string, any>
    actionHistory: Record<string, any> | null
    authorization: Record<string, any>
}) {
    const eventIds = input.timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id))
    const actionTypes = uniqueTimelineValues(input.timeline.map(event => event.action || event.actionType))
    const outcomes = uniqueTimelineValues(input.timeline.map(event => event.outcome))
    const severities = uniqueTimelineValues(input.timeline.map(event => event.severity))
    const actorIds = uniqueTimelineValues([input.actorId, ...input.timeline.map(event => event.actor?.id || event.actorId)])
    const targetIds = uniqueTimelineValues([
        input.user,
        input.email,
        input.org,
        ...input.timeline.map(event => event.target?.id || event.targetId),
    ])
    const entityIds = uniqueTimelineValues([
        input.entity,
        input.supportSession,
        ...input.timeline.map(event => event.entity?.id || event.entityId),
    ])
    const requestIds = uniqueTimelineValues([
        input.request,
        ...input.timeline.map(event => event.requestId),
    ])
    const recoveryBlockers = Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []
    const approvalBlockers = Array.isArray(input.approvalDecisionPacket.blockers) ? input.approvalDecisionPacket.blockers : []
    const receiptBlockers = Array.isArray(input.receiptReplayPacket.blockers) ? input.receiptReplayPacket.blockers : []
    const sessionBlockers = Array.isArray(input.sessionReplayReceipt.blockers) ? input.sessionReplayReceipt.blockers : []
    const authorizationBlockers = Array.isArray(input.authorization.blockers) ? input.authorization.blockers : []
    const recoveryDecisionRoutes = Array.isArray(input.approvalDecisionPacket.decisions)
        ? input.approvalDecisionPacket.decisions.flatMap((decision: Record<string, any>) => [decision.routes?.approve, decision.routes?.deny, decision.routes?.detail]).filter(Boolean)
        : []
    return {
        schemaVersion: 'support.inspection.replay_export_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        reasonRequiredForSensitiveActions: true,
        scopeRequiredForSensitiveActions: true,
        durationOrExpiryRequired: true,
        target: {
            organizationId: input.org || input.organizationIds[0] || null,
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            entityId: input.entity || input.supportSession || null,
            entityType: input.entityType || null,
            supportSessionId: input.supportSession || null,
        },
        actor: {
            id: input.actorId,
            relatedActorIds: actorIds,
        },
        auditEventIds: eventIds,
        requestIds,
        targetIds,
        entityIds,
        actions: actionTypes,
        outcomes,
        severities,
        supportSession: input.supportSession ? {
            id: input.supportSession,
            status: input.sessionReplayReceipt.status || null,
            expiresAt: input.sessionReplayReceipt.expiresAt || null,
            revokedAt: input.sessionReplayReceipt.revokedAt || null,
            outcome: input.sessionReplayReceipt.outcome || null,
            blockers: sessionBlockers,
        } : null,
        replayFilters: {
            current: auditFilterQuery(input.timelineFilter),
            byRequest: requestIds.map(request => auditFilterQuery({ ...input.timelineFilter, request })),
            byEntity: entityIds.map(entity => auditFilterQuery({ entity, request: input.request, source: 'admin', service: 'hanasand-api' })),
            byTarget: targetIds.map(target => auditFilterQuery({ target, request: input.request, source: 'admin', service: 'hanasand-api' })),
            byAction: actionTypes.map(action => auditFilterQuery({ ...input.timelineFilter, action })),
            byOutcome: outcomes.map(outcome => auditFilterQuery({ ...input.timelineFilter, outcome })),
            bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }) : null,
            recovery: auditFilterQuery({ org: input.org || input.organizationIds[0] || '', target: input.user || input.email, action: 'access_recovery', request: input.request }),
            impersonation: auditFilterQuery({ target: input.user, action: 'impersonation', request: input.request, source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
        },
        receiptSchemas: [
            'support.inspection.replay_export_packet.v1',
            'support.inspection.receipt_replay_packet.v1',
            'support.scoped_session.replay_receipt.v1',
            'support.organization.action_history_receipt.v1',
            'support.user.action_history_receipt.v1',
            'support.access_recovery.decision_receipt.v1',
            'support.impersonation.lifecycle_receipt.v1',
            'support.audit.support_workflow_packet.v1',
        ],
        bundledReceipts: {
            receiptReplay: input.receiptReplayPacket.schemaVersion || null,
            sessionReplay: input.sessionReplayReceipt.schemaVersion || null,
            approvalDecision: input.approvalDecisionPacket.schemaVersion || null,
            actionHistory: input.actionHistory?.schemaVersion || null,
        },
        nextRoutes: {
            inspect: '/api/admin/support/inspect',
            audit: auditFilterQuery(input.timelineFilter),
            details: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            supportSession: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
            accessRecovery: input.organizationIds[0] ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationIds[0])}/access-recovery` : null,
            approvalDecisions: recoveryDecisionRoutes,
            impersonation: input.user ? `/api/impersonation/events?target=${encodeURIComponent(input.user)}` : null,
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'support_session_not_found',
            'support_session_expired',
            'support_session_revoked',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'pending_approval_requires_decision',
            'denied_recovery_approval',
            'missing_receipt_audit_events',
            'cross_org_match_requires_explicit_scope',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            eventIds.length ? '' : 'missing_receipt_audit_events',
            input.timelineFilter.unsupported.length ? 'unsupported_audit_filter' : '',
            ...recoveryBlockers,
            ...approvalBlockers,
            ...receiptBlockers,
            ...sessionBlockers,
            ...authorizationBlockers,
        ]),
        copyText: [
            `Support replay export org=${input.org || '*'} user=${input.user || '*'} request=${input.request || '*'} session=${input.supportSession || '*'}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Actions: ${actionTypes.join(', ') || 'none'}`,
            `Outcomes: ${outcomes.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}
