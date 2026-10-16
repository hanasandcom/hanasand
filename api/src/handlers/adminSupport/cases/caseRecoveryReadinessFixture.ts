import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'

export function supportOrgCaseRecoveryReadinessFixture(input: {
    kind: 'organization' | 'user'
    actorId: string
    targetId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    accessRecoveryPlan: Record<string, any>
    eventIds: number[]
    requestIds: string[]
    entityIds: string[]
    actionTypes: string[]
    outcomes: string[]
}) {
    const planItems = Array.isArray(input.accessRecoveryPlan.items) ? input.accessRecoveryPlan.items : []
    const recoveryRoutes = uniqueTimelineValues(planItems.flatMap((item: Record<string, any>) => [
        item.guardedOperations?.controlledRecoveryInvite?.route,
        item.guardedOperations?.memberRoleRecovery?.route,
        item.guardedOperations?.inviteResend?.route,
        item.guardedOperations?.inviteRevoke?.route,
    ]))
    const recoveryActions = uniqueTimelineValues(planItems.flatMap((item: Record<string, any>) => item.recommendedActions || []))
    const recoveryBlockers = uniqueTimelineValues([
        ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        ...planItems.flatMap((item: Record<string, any>) => item.blockers || []),
    ])
    const targetOrg = input.kind === 'organization' ? input.targetId : input.organizationIds[0] || ''
    const targetUser = input.kind === 'user' ? input.targetId : ''
    return {
        schemaVersion: 'support.recovery.org_case_readiness_fixture.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        reasonRequiredBeforeMutation: true,
        contextRequiredBeforeMutation: true,
        noLiveAccessGrant: true,
        noSilentMembershipMutation: true,
        noCrossOrgLeakage: true,
        actorId: input.actorId,
        target: {
            kind: input.kind,
            targetId: input.targetId,
            organizationIds: input.organizationIds,
            organizationId: targetOrg || null,
            targetUserId: targetUser || null,
            requestId: input.requestId,
        },
        readiness: {
            accessRecoveryPlan: input.accessRecoveryPlan.schemaVersion || null,
            planItemCount: planItems.length,
            recommendedActions: recoveryActions,
            guardedRoutes: recoveryRoutes,
            recoveryEligible: Boolean(recoveryRoutes.length),
            reasonPresent: Boolean(input.reason),
            supportContextPresent: Boolean(input.supportContext),
        },
        audit: {
            eventIds: input.eventIds,
            requestIds: input.requestIds,
            entityIds: input.entityIds,
            actionTypes: input.actionTypes,
            outcomes: input.outcomes,
            replay: auditFilterQuery(input.timelineFilter),
            byRecovery: auditFilterQuery({ org: targetOrg, target: targetUser || input.targetId, action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' }),
            byMemberRecovery: auditFilterQuery({ org: targetOrg, target: targetUser || input.targetId, action: 'support.organization.member_role_recovery', source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
        },
        caseReplay: {
            schemaVersion: 'support.recovery.case_replay_fixture.v1',
            caseId: input.requestId ? `support-case:${input.requestId}` : `support-case:${input.targetId}`,
            expectedConsumer: 'case.replay',
            requiredFields: ['organizationId', 'targetUserId', 'requestId', 'reason', 'auditEventIds', 'outcome', 'replay'],
            noMutation: true,
            replay: auditFilterQuery(input.timelineFilter),
        },
        orgReadiness: {
            schemaVersion: 'support.recovery.org_readiness_bridge.v1',
            expectedConsumer: 'organization.readiness',
            organizationIds: input.organizationIds,
            requiredContracts: ['support.access_recovery.plan.v1', 'support.recovery.org_case_readiness_fixture.v1'],
            noLiveAccessGrant: true,
        },
        denialCases: [
            'support_role_required',
            'missing_operator_reason',
            'missing_support_context',
            'active_admin_available',
            'ambiguous_org_target',
            'wrong_org_scope',
            'support_session_expired',
            'support_session_revoked',
            'denied_recovery_approval',
            'duplicate_invite_or_idempotency_key',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            input.reason ? '' : 'missing_operator_reason',
            input.supportContext ? '' : 'missing_support_context',
            input.eventIds.length ? '' : 'missing_action_history_events',
            ...recoveryBlockers,
        ]),
        copyText: [
            `Support recovery readiness ${input.kind}:${input.targetId}`,
            `Request: ${input.requestId}`,
            `Routes: ${recoveryRoutes.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}
