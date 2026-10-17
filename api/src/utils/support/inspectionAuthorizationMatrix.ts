import { auditFilterQuery, uniqueTimelineValues, type SupportInspectionPacket, type SupportTimelineFilter } from './inspectionPacketShared.ts'
import { supportText as text } from './adminSupportInput.ts'

export function supportInspectionAuthorizationMatrix(input: {
    authorization: Record<string, any>
    workbench: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    supportSession: string
    sessionState: Record<string, any> | null
    organizationIds: string[]
    user: string
    email: string
    request: string
    timelineFilter: SupportTimelineFilter
}): SupportInspectionPacket {
    const scoped = Boolean(input.supportSession)
    const sessionBlockers = Array.isArray(input.authorization.blockers) ? input.authorization.blockers : []
    const planBlockers = Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []
    const actions = {
        inspect: {
            allowed: true,
            requiredInputs: ['org|user|email|request|entity|supportSession'],
            blockers: sessionBlockers,
            auditAction: 'support.inspect',
        },
        inviteAssist: {
            allowed: Boolean(input.workbench.inviteAssistance?.available) && !sessionBlockers.length,
            requiredInputs: ['reason', 'context', 'scope', 'idempotencyKey'],
            blockers: uniqueTimelineValues([...(input.workbench.inviteAssistance?.blockers || []), ...sessionBlockers]),
            auditAction: 'support.organization.invite_assist',
        },
        accessRecovery: {
            allowed: Boolean(input.workbench.accessRecovery?.available) && !sessionBlockers.length,
            requiredInputs: ['reason', 'context', 'expiresAt', 'requestId'],
            blockers: uniqueTimelineValues([...(input.workbench.accessRecovery?.blockers || []), ...planBlockers, ...sessionBlockers]),
            auditAction: 'support.organization.access_recovery',
        },
        memberRoleRecovery: {
            allowed: Boolean(input.accessRecoveryPlan.items?.some((item: Record<string, any>) => item.guardedOperations?.memberRoleRecovery?.available)) && !sessionBlockers.length,
            requiredInputs: ['reason', 'context', 'role', 'requestId'],
            blockers: uniqueTimelineValues([...planBlockers, ...sessionBlockers]),
            auditAction: 'support.organization.member_role_recovery',
        },
        impersonation: {
            allowed: Boolean(input.workbench.impersonationAssistance?.eligible) && !sessionBlockers.length,
            requiredInputs: ['reason', 'context', 'scope', 'durationMinutes', 'targetUserId', 'organizationId'],
            blockers: uniqueTimelineValues([...(input.workbench.impersonationAssistance?.blockers || []), ...sessionBlockers]),
            auditAction: 'impersonation.start',
        },
    }
    return {
        schemaVersion: 'support.inspection.authorization_matrix.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        supportSessionScoped: scoped,
        supportSessionId: input.supportSession || null,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        scopedSession: input.sessionState ? {
            status: input.sessionState.status || null,
            allowedActions: Array.isArray(input.sessionState.allowedActions) ? input.sessionState.allowedActions : [],
            scope: Array.isArray(input.sessionState.scope) ? input.sessionState.scope : [],
            expiresAt: input.sessionState.expiresAt || null,
            reasonPresent: Boolean(text(input.sessionState.reason)),
        } : null,
        actions,
        audit: {
            filter: input.timelineFilter,
            matrixReplay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            supportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }) : null,
        },
        guardrails: {
            noCrossOrgLeakage: true,
            reasonRequiredForActions: true,
            contextRequiredForActions: true,
            scopeRequiredForActions: true,
            noSilentMembershipMutation: true,
            redactionRequired: true,
        },
        blockers: uniqueTimelineValues([
            ...sessionBlockers,
            ...Object.values(actions).flatMap(action => action.blockers),
        ]),
        copyText: [
            `Support authorization matrix user=${input.user || '*'} email=${input.email || '*'} org=${input.organizationIds.join(',') || '*'}`,
            `Scoped session: ${input.supportSession || 'none'}`,
            `Invite/recovery/member/impersonation: ${actions.inviteAssist.allowed}/${actions.accessRecovery.allowed}/${actions.memberRoleRecovery.allowed}/${actions.impersonation.allowed}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}
