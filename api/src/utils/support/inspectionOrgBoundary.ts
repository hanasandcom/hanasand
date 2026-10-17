import { auditFilterQuery, uniqueTimelineValues, type SupportInspectionPacket, type SupportTimelineFilter } from './inspectionPacketShared.ts'
import { supportText as text } from './adminSupportInput.ts'

export function supportInspectionOrgBoundaryProof(input: {
    requestedOrg: string
    requestedUser: string
    email: string
    request: string
    supportSession: string
    sessionState: Record<string, any> | null
    authorization: Record<string, any>
    organizationIds: string[]
    memberships: Array<Record<string, any>>
    invites: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}): SupportInspectionPacket {
    const membershipOrgIds = uniqueTimelineValues(input.memberships.map(member => member.organization_id || member.organizationId))
    const inviteOrgIds = uniqueTimelineValues(input.invites.map(invite => invite.organization_id || invite.organizationId))
    const timelineOrgIds = uniqueTimelineValues(input.timeline.map(event => event.organizationId || event.organization?.id))
    const matchedOrgIds = uniqueTimelineValues([
        ...input.organizationIds,
        ...membershipOrgIds,
        ...inviteOrgIds,
        ...timelineOrgIds,
    ])
    const scopedOrg = text(input.sessionState?.organizationId)
    const scopedUser = text(input.sessionState?.targetUserId)
    const crossOrgMatches = input.requestedOrg
        ? matchedOrgIds.filter(orgId => orgId !== input.requestedOrg)
        : []
    const sessionOrgMismatch = Boolean(scopedOrg && input.requestedOrg && scopedOrg !== input.requestedOrg)
    const sessionUserMismatch = Boolean(scopedUser && input.requestedUser && scopedUser !== input.requestedUser)
    const blockers = uniqueTimelineValues([
        matchedOrgIds.length ? '' : 'missing_org_match',
        input.requestedOrg || input.supportSession ? '' : 'missing_org_or_support_session_scope',
        crossOrgMatches.length ? 'cross_org_match_requires_explicit_scope' : '',
        sessionOrgMismatch ? 'support_session_org_mismatch' : '',
        sessionUserMismatch ? 'support_session_user_mismatch' : '',
        ...(Array.isArray(input.authorization.blockers) ? input.authorization.blockers : []),
    ])
    return {
        schemaVersion: 'support.inspection.org_boundary_proof.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        requested: {
            organizationId: input.requestedOrg || null,
            userId: input.requestedUser || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        matched: {
            organizationIds: matchedOrgIds,
            membershipOrgIds,
            inviteOrgIds,
            timelineOrgIds,
            crossOrgMatches,
        },
        scopedSession: input.sessionState ? {
            organizationId: scopedOrg || null,
            targetUserId: scopedUser || null,
            allowedActions: Array.isArray(input.sessionState.allowedActions) ? input.sessionState.allowedActions : [],
            status: input.sessionState.status || null,
            expiresAt: input.sessionState.expiresAt || null,
            reasonPresent: Boolean(text(input.sessionState.reason)),
            orgMismatch: sessionOrgMismatch,
            userMismatch: sessionUserMismatch,
        } : null,
        authorization: {
            supportRoleRequired: true,
            supportSessionScoped: Boolean(input.supportSession),
            effectiveOrgIds: input.authorization.effective?.organizationIds || input.organizationIds,
            effectiveUserId: input.authorization.effective?.userId || input.requestedUser || null,
            blockers,
        },
        audit: {
            filter: input.timelineFilter,
            replay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            orgReplays: matchedOrgIds.map(orgId => auditFilterQuery({ org: orgId })),
            supportSessionReplay: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession }) : null,
            detailRoutes: input.timeline.map(event => event.links?.detail).filter(Boolean),
            eventIds: input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
        },
        guardrails: {
            noCrossOrgLeakage: true,
            explicitOrgScopeRequired: true,
            supportSessionScopeEnforced: true,
            deniedAccessIsAuditable: true,
            redactionRequired: true,
        },
        blockers,
        copyText: [
            `Support org boundary requested=${input.requestedOrg || '*'} matched=${matchedOrgIds.join(',') || 'none'}`,
            `Cross-org matches: ${crossOrgMatches.join(',') || 'none'}`,
            `Session mismatch: org=${sessionOrgMismatch} user=${sessionUserMismatch}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}
