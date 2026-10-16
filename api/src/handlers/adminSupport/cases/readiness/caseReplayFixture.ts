import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'

export function supportRecoveryCaseReplayFixture(input: {
    actorId: string
    org: string
    user: string
    email: string
    request: string
    entity: string
    entityType: string
    supportSession: string
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    eventIds: number[]
    actions: string[]
    outcomes: string[]
    requestIds: string[]
    entityIds: string[]
}) {
    const recoveryActions = input.actions.filter(action => /access_recovery|member_role_recovery|invite|impersonation/.test(action))
    const recoveryEvents = input.timeline.filter(event => /access_recovery|member_role_recovery|invite|impersonation/.test(text(event.action || event.actionType)))
    const targetId = input.user || input.email || input.entity
    const caseId = input.request ? `support-case:${input.request}` : targetId ? `support-case:${targetId}` : 'support-case:readiness'
    const replayFilter = {
        ...input.timelineFilter,
        org: input.org,
        target: targetId,
        request: input.request,
        supportSession: input.supportSession,
        source: 'admin',
        service: 'hanasand-api',
    }
    return {
        schemaVersion: 'support.recovery.case_replay_fixture.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        caseId,
        actorId: input.actorId,
        target: {
            organizationId: input.org || null,
            targetUserId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            entityId: input.entity || null,
            entityType: input.entityType || null,
            supportSessionId: input.supportSession || null,
        },
        replay: {
            current: auditFilterQuery(replayFilter),
            byCaseRequest: input.requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
            byEntity: input.entityIds.map(entity => auditFilterQuery({ entity, source: 'admin', service: 'hanasand-api' })),
            byRecoveryAction: recoveryActions.map(action => auditFilterQuery({ org: input.org, target: targetId, action, source: 'admin', service: 'hanasand-api' })),
            deniedRecovery: auditFilterQuery({ org: input.org, target: targetId, action: 'support.organization.access_recovery', outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            supportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }) : null,
        },
        evidence: {
            auditEventIds: input.eventIds,
            recoveryEventIds: recoveryEvents.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
            actionTypes: input.actions,
            recoveryActions,
            outcomes: input.outcomes,
            requestIds: input.requestIds,
            entityIds: input.entityIds,
        },
        requiredCaseFields: [
            'caseId',
            'organizationId',
            'targetUserId',
            'requestId',
            'supportSessionId',
            'auditEventIds',
            'reason',
            'outcome',
            'replay.current',
        ],
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noCrossOrgLeakage: true,
            reasonRequiredBeforeExecution: true,
            scopedSessionRequiredForImpersonation: true,
            redactionRequired: true,
        },
        receiptSchemas: [
            'support.recovery.case_replay_fixture.v1',
            'support.member_recovery.handoff_receipt.v1',
            'support.access_recovery.decision_receipt.v1',
            'support.impersonation.lifecycle_receipt.v1',
            'support.audit.timeline_replay_contract.v1',
        ],
        nextRoutes: {
            supportReadiness: '/api/admin/support/readiness',
            supportInspection: `/api/admin/support/inspect?${new URLSearchParams({
                org: input.org,
                user: input.user,
                email: input.email,
                request: input.request,
                supportSession: input.supportSession,
            }).toString()}`,
            auditReplay: auditFilterQuery(replayFilter),
            auditDetails: input.eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            accessRecoveryQueue: '/api/admin/support/access-recovery',
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'support_session_revoked',
            'support_session_expired',
            'support_session_scope_denied',
            'wrong_org_scope',
            'denied_recovery_approval',
            'duplicate_invite_or_idempotency_key',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers: [
            input.eventIds.length ? '' : 'audit_unavailable',
            recoveryEvents.length ? '' : 'missing_recovery_or_impersonation_events',
            targetId ? '' : 'missing_case_target',
        ].filter(Boolean),
        copyText: [
            `Support recovery case replay ${caseId}`,
            `Target org=${input.org || '*'} user=${input.user || '*'} request=${input.request || '*'}`,
            `Recovery events: ${recoveryEvents.map(event => event.id).join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(replayFilter)}`,
        ].join('\n'),
    }
}
