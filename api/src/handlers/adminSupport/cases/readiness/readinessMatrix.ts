import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'

export function supportRecoveryReadinessMatrix(input: {
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
    const targetId = input.user || input.email || input.entity
    const actionEvidence = (pattern: RegExp) => input.timeline
        .filter(event => pattern.test(text(event.action || event.actionType)))
        .map(event => Number(event.id))
        .filter(id => Number.isFinite(id))
    const lane = (name: string, actionPatterns: string[], requiredScope: string[], extraBlockers: string[] = []) => {
        const pattern = new RegExp(actionPatterns.join('|'))
        const evidenceIds = actionEvidence(pattern)
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
            name,
            status: evidenceIds.length ? 'ready' : 'needs_evidence',
            requiredScope,
            requiredFields: ['reason', 'context', 'requestId', 'supportSessionId'],
            auditEventIds: evidenceIds,
            replayFilters: {
                current: auditFilterQuery(replayFilter),
                byRequest: input.requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
                byOutcome: input.outcomes.map(outcome => auditFilterQuery({ ...replayFilter, outcome })),
                denied: auditFilterQuery({ ...replayFilter, outcome: 'denied' }),
                bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }) : null,
                byEntity: input.entityIds.map(entity => auditFilterQuery({ entity, source: 'admin', service: 'hanasand-api' })),
            },
            blockers: uniqueTimelineValues([
                evidenceIds.length ? '' : 'missing_recovery_evidence',
                input.org || input.user || input.email ? '' : 'missing_recovery_target',
                input.supportSession ? '' : 'missing_support_session_scope',
                ...extraBlockers,
            ]),
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noCrossOrgLeakage: true,
            redacted: true,
        }
    }
    const lanes = [
        lane('inviteRecovery', ['invite_resend', 'invite_revoke', 'invite_assist'], ['invite:resend', 'invite:revoke'], ['duplicate_invite_or_idempotency_key']),
        lane('accessRecovery', ['access_recovery'], ['access:recovery'], ['pending_approval_requires_decision', 'denied_recovery_approval']),
        lane('memberRecovery', ['member_role_recovery'], ['member:role_recovery'], ['wrong_org_scope']),
        lane('impersonation', ['impersonation'], ['impersonation:start'], ['support_session_expired', 'support_session_revoked', 'support_session_scope_denied']),
    ]
    return {
        schemaVersion: 'support.recovery.readiness_matrix.v1',
        generatedAt: new Date().toISOString(),
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
        lanes,
        readyLanes: lanes.filter(item => item.status === 'ready').map(item => item.name),
        blockedLanes: lanes.filter(item => item.blockers.length > 0).map(item => ({ name: item.name, blockers: item.blockers })),
        auditEventIds: input.eventIds,
        actionTypes: input.actions,
        outcomes: input.outcomes,
        requestIds: input.requestIds,
        entityIds: input.entityIds,
        requiredReceipts: [
            'support.invite_recovery.denial_receipt.v1',
            'support.access_recovery.execution_receipt.v1',
            'support.member_recovery.handoff_receipt.v1',
            'support.impersonation.lifecycle_receipt.v1',
        ],
        caseReplay: {
            route: '/api/admin/support/receipt-replay',
            filter: auditFilterQuery({ ...input.timelineFilter, org: input.org, target: targetId, request: input.request, supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }),
            safeHandoff: {
                noLiveAccessGrant: true,
                noSilentMembershipMutation: true,
                noCrossOrgLeakage: true,
                redactionRequired: true,
            },
        },
    }
}
