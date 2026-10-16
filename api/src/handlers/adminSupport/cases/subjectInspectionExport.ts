import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportOrgCaseRecoveryReadinessFixture } from './caseRecoveryReadinessFixture.ts'
import { supportRecoveryReadinessMatrix } from './readiness/readinessMatrix.ts'
import { supportOrgUserActionHistoryReceipt } from './actionHistoryReceipt.ts'

export function supportOrgUserActionHistoryExportReceipt(input: {
    kind: 'organization' | 'user'
    actorId: string
    targetId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    inspectionReceipt: Record<string, any>
    actionHistoryReceipt: ReturnType<typeof supportOrgUserActionHistoryReceipt>
    accessRecoveryPlan: Record<string, any>
    supportActivityRollup: Record<string, any>
    nextRoutes: Record<string, string | null>
}) {
    const { auditEventIds: eventIds, actions: actionTypes, outcomes, requestIds, entityIds } = input.actionHistoryReceipt
    const recoveryBlockers = Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []
    const historyBlockers = Array.isArray(input.actionHistoryReceipt.blockers) ? input.actionHistoryReceipt.blockers : []
    const activityBlockers = Array.isArray(input.supportActivityRollup.blockerCodes) ? input.supportActivityRollup.blockerCodes : []
    return {
        schemaVersion: `support.${input.kind}.action_history_export.v1`,
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        reasonRecommended: true,
        targetType: input.kind === 'organization' ? 'organization' : 'user',
        targetId: input.targetId,
        organizationIds: input.organizationIds,
        organizationId: input.kind === 'organization' ? input.targetId : input.organizationIds[0] || null,
        actorId: input.actorId,
        requestId: input.requestId,
        reason: input.reason || null,
        reasonPresent: Boolean(input.reason),
        supportContextPresent: Boolean(input.supportContext),
        scope: input.kind === 'organization' ? ['read_org', 'audit:read', 'recovery:review'] : ['read_profile', 'read_org', 'audit:read', 'impersonation:review'],
        auditEventIds: eventIds,
        requestIds,
        entityIds,
        actions: actionTypes,
        outcomes,
        replayFilters: {
            current: auditFilterQuery(input.timelineFilter),
            byRequest: requestIds.map(request => auditFilterQuery({ ...input.timelineFilter, request })),
            byEntity: entityIds.map(entity => auditFilterQuery({ entity, target: input.targetId, source: 'admin', service: 'hanasand-api' })),
            byAction: actionTypes.map(action => auditFilterQuery({ ...input.timelineFilter, action })),
            byOutcome: outcomes.map(outcome => auditFilterQuery({ ...input.timelineFilter, outcome })),
            recovery: auditFilterQuery({ org: input.organizationIds[0] || input.targetId, target: input.targetId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            impersonation: auditFilterQuery({ target: input.kind === 'user' ? input.targetId : '', org: input.kind === 'organization' ? input.targetId : '', action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
        },
        bundledReceipts: {
            inspection: input.inspectionReceipt.schemaVersion || null,
            actionHistory: input.actionHistoryReceipt.schemaVersion || null,
            accessRecoveryPlan: input.accessRecoveryPlan.schemaVersion || null,
            activityRollup: input.supportActivityRollup.schemaVersion || null,
        },
        orgCaseRecoveryReadiness: supportOrgCaseRecoveryReadinessFixture({
            kind: input.kind,
            actorId: input.actorId,
            targetId: input.targetId,
            organizationIds: input.organizationIds,
            requestId: input.requestId,
            reason: input.reason,
            supportContext: input.supportContext,
            timelineFilter: input.timelineFilter,
            timeline: input.timeline,
            accessRecoveryPlan: input.accessRecoveryPlan,
            eventIds,
            requestIds,
            entityIds,
            actionTypes,
            outcomes,
        }),
        recoveryReadinessMatrix: supportRecoveryReadinessMatrix({
            actorId: input.actorId,
            org: input.kind === 'organization' ? input.targetId : input.organizationIds[0] || '',
            user: input.kind === 'user' ? input.targetId : '',
            email: '',
            request: input.requestId,
            entity: input.targetId,
            entityType: input.kind,
            supportSession: '',
            timelineFilter: input.timelineFilter,
            timeline: input.timeline,
            eventIds,
            actions: actionTypes,
            outcomes,
            requestIds,
            entityIds,
        }),
        receiptSchemas: [
            `support.${input.kind}.action_history_export.v1`,
            'support.recovery.org_case_readiness_fixture.v1',
            'support.recovery.readiness_matrix.v1',
            `support.${input.kind}.action_history_receipt.v1`,
            `support.${input.kind}.inspection_receipt.v1`,
            'support.access_recovery.decision_receipt.v1',
            'support.impersonation.lifecycle_receipt.v1',
            'support.audit.support_workflow_packet.v1',
        ],
        nextRoutes: {
            ...input.nextRoutes,
            replay: auditFilterQuery(input.timelineFilter),
            details: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            filteredInspection: `/api/admin/support/inspect?${new URLSearchParams({
                entity: input.targetId,
                request: input.requestId,
                action: input.kind === 'organization' ? 'support.organization' : 'support.user',
            }).toString()}`,
        },
        denialCases: [
            'support_role_required', 'support_auth_required', 'missing_operator_reason',
            'missing_action_history_events', 'pending_approval_requires_decision',
            'denied_recovery_approval', 'support_session_expired', 'support_session_revoked',
            'cross_org_match_requires_explicit_scope', 'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            eventIds.length ? '' : 'missing_action_history_events',
            input.reason ? '' : 'missing_operator_reason',
            ...recoveryBlockers,
            ...historyBlockers,
            ...activityBlockers,
        ]),
        copyText: [
            `Support ${input.kind} action history export ${input.targetId}`,
            `Request: ${input.requestId}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Actions: ${actionTypes.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}
