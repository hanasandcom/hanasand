import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { supportActivityTimelineSummary } from '../audit/auditEntityTimeline.ts'

export function supportOrganizationActivityRollup(input: {
    organizationId: string
    requestId: string
    timeline: Array<Record<string, any>>
}) {
    const { events: supportEvents, ...activitySummary } = supportActivityTimelineSummary(input.timeline)
    const actions = {
        inviteAssistance: supportEvents.filter(event => text(event.action).includes('invite')),
        accessRecovery: supportEvents.filter(event => text(event.action).includes('access_recovery')),
        memberRoleRecovery: supportEvents.filter(event => text(event.action).includes('member_role_recovery')),
        impersonation: supportEvents.filter(event => text(event.action).startsWith('impersonation.')),
        supportSessions: supportEvents.filter(event => text(event.action).startsWith('support.session')),
    }
    return {
        schemaVersion: 'support.organization.activity_rollup.v1',
        generatedAt: new Date().toISOString(),
        organizationId: input.organizationId,
        requestId: input.requestId || null,
        eventCount: activitySummary.eventCount,
        eventIds: activitySummary.eventIds,
        actionCounts: {
            inviteAssistance: actions.inviteAssistance.length,
            accessRecovery: actions.accessRecovery.length,
            memberRoleRecovery: actions.memberRoleRecovery.length,
            impersonation: actions.impersonation.length,
            supportSessions: actions.supportSessions.length,
        },
        outcomes: activitySummary.outcomes,
        severities: uniqueTimelineValues(supportEvents.map(event => event.severity)),
        requestIds: activitySummary.requestIds,
        actorIds: uniqueTimelineValues(supportEvents.map(event => event.actor?.id)),
        targetIds: uniqueTimelineValues(supportEvents.map(event => event.target?.id)),
        blockerCodes: activitySummary.blockerCodes,
        links: {
            timeline: auditFilterQuery({ org: input.organizationId, source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: input.organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            inviteAssistance: auditFilterQuery({ org: input.organizationId, action: 'invite', source: 'admin', service: 'hanasand-api' }),
            accessRecovery: auditFilterQuery({ org: input.organizationId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            memberRoleRecovery: auditFilterQuery({ org: input.organizationId, action: 'member_role_recovery', source: 'admin', service: 'hanasand-api' }),
            impersonation: auditFilterQuery({ org: input.organizationId, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
        },
        guardrails: {
            supportRoleRequired: true,
            reasonRequiredForActions: true,
            contextRequiredForActions: true,
            noSilentMembershipMutation: true,
            redactionRequired: true,
        },
        redacted: true,
        copyText: [
            `Support activity org=${input.organizationId}`,
            `Events: ${activitySummary.eventIds.join(', ') || 'none'}`,
            `Invite/access/member/impersonation: ${actions.inviteAssistance.length}/${actions.accessRecovery.length}/${actions.memberRoleRecovery.length}/${actions.impersonation.length}`,
            `Denied replay: ${auditFilterQuery({ org: input.organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}

export function supportUserActivityRollup(input: {
    userId: string
    requestId: string
    organizationIds: string[]
    timeline: Array<Record<string, any>>
}) {
    const { events: supportEvents, ...activitySummary } = supportActivityTimelineSummary(input.timeline)
    const actionEvents = {
        inspections: supportEvents.filter(event => text(event.action).includes('.inspect')),
        inviteAssistance: supportEvents.filter(event => text(event.action).includes('invite')),
        accessRecovery: supportEvents.filter(event => text(event.action).includes('access_recovery')),
        memberRoleRecovery: supportEvents.filter(event => text(event.action).includes('member_role_recovery')),
        impersonation: supportEvents.filter(event => text(event.action).startsWith('impersonation.')),
    }
    return {
        schemaVersion: 'support.user.activity_rollup.v1',
        generatedAt: new Date().toISOString(),
        userId: input.userId,
        organizationIds: input.organizationIds,
        requestId: input.requestId || null,
        eventCount: activitySummary.eventCount,
        eventIds: activitySummary.eventIds,
        actionCounts: {
            inspections: actionEvents.inspections.length,
            inviteAssistance: actionEvents.inviteAssistance.length,
            accessRecovery: actionEvents.accessRecovery.length,
            memberRoleRecovery: actionEvents.memberRoleRecovery.length,
            impersonation: actionEvents.impersonation.length,
        },
        outcomes: activitySummary.outcomes,
        requestIds: activitySummary.requestIds,
        organizationTimelineLinks: input.organizationIds.map(organizationId => ({
            organizationId,
            timeline: auditFilterQuery({ org: organizationId, target: input.userId, source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: organizationId, target: input.userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        })),
        links: {
            timeline: auditFilterQuery({ target: input.userId, source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ target: input.userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            accessRecovery: auditFilterQuery({ target: input.userId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            memberRoleRecovery: auditFilterQuery({ target: input.userId, action: 'member_role_recovery', source: 'admin', service: 'hanasand-api' }),
            impersonation: auditFilterQuery({ target: input.userId, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
        },
        guardrails: {
            supportRoleRequired: true,
            reasonRequiredForActions: true,
            contextRequiredForActions: true,
            scopedSessionRequiredForImpersonation: true,
            redactionRequired: true,
        },
        blockerCodes: activitySummary.blockerCodes,
        redacted: true,
        copyText: [
            `Support activity user=${input.userId}`,
            `Events: ${activitySummary.eventIds.join(', ') || 'none'}`,
            `Recovery/member/impersonation: ${actionEvents.accessRecovery.length}/${actionEvents.memberRoleRecovery.length}/${actionEvents.impersonation.length}`,
            `Denied replay: ${auditFilterQuery({ target: input.userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}
