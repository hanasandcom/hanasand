import { supportText as text } from './adminSupportInput.ts'

export type SupportInspectionPacket = Record<string, any> & {
    schemaVersion: string
    generatedAt: string
    blockers: string[]
    copyText: string
    redacted?: boolean
    noMutation?: boolean
}

export type SupportTimelineFilter = {
    q?: string
    org: string
    user: string
    email: string
    request: string
    entity: string
    entityType: string
    supportSession: string
    workflow?: string
    action: string
    severity: string
    outcome: string
    source: string
    service: string
    blocker: string
    reason: string
    scope?: string
    context: string
    from: string
    to: string
    limit: number
    unsupported: string[]
}

export const supportInspectionFilters = new Set([
    'q',
    'org',
    'orgId',
    'user',
    'userId',
    'email',
    'request',
    'requestId',
    'entity',
    'entityId',
    'entityType',
    'session',
    'supportSession',
    'supportSessionId',
    'workflow',
    'bridgeWorkflow',
    'sourceWorkflow',
    'action',
    'severity',
    'outcome',
    'source',
    'service',
    'blocker',
    'blockerCode',
    'prepareAction',
    'reason',
    'supportReason',
    'supportScope',
    'context',
    'supportContext',
    'scope',
    'idempotencyKey',
    'idempotency_key',
    'durationMinutes',
    'duration_minutes',
    'expiresAt',
    'expires_at',
    'from',
    'to',
    'limit',
    'cursor',
])

export function auditFilterQuery(filters: Record<string, unknown>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue
        params.set(key, String(value))
    }
    return `/api/admin/audit-events?${params.toString()}`
}

export function uniqueTimelineValues(values: unknown[]) {
    return Array.from(new Set(values.map(value => text(value)).filter(Boolean))).slice(0, 50)
}

function supportInspectionRequestIds(request: string, timeline: Array<Record<string, any>>) {
    return uniqueTimelineValues([request, ...timeline.map(event => event.requestId)])
}

export function supportInspectionSearchProof(input: {
    q: string
    org: string
    user: string
    email: string
    request: string
    entity: string
    supportSession: string
    organizationIds: string[]
    organizations: Record<string, unknown>[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}): SupportInspectionPacket {
    const pendingInvites = input.invites.filter(row => text(row.status) === 'pending')
    const activeMemberships = input.memberships.filter(row => text(row.status) === 'active')
    const removedMemberships = input.memberships.filter(row => text(row.status) === 'removed')
    const auditQuery = auditFilterQuery({
        q: input.q,
        org: input.org,
        target: input.user || input.email,
        request: input.request,
        entity: input.entity || input.supportSession,
        supportSession: input.supportSession,
    })
    const blockers = [
        input.q || input.org || input.user || input.email || input.request || input.entity || input.supportSession ? '' : 'missing_search_target',
        input.organizationIds.length ? '' : 'organization_not_identified',
        input.timeline.length ? '' : 'audit_unavailable',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.inspection.search_proof.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        query: {
            q: input.q || null,
            org: input.org || null,
            user: input.user || null,
            email: input.email || null,
            request: input.request || null,
            entity: input.entity || null,
            supportSession: input.supportSession || null,
        },
        resultCounts: {
            organizations: input.organizations.length,
            users: input.users.length,
            memberships: input.memberships.length,
            activeMemberships: activeMemberships.length,
            removedMemberships: removedMemberships.length,
            pendingInvites: pendingInvites.length,
            approvals: input.approvalDetails.length,
            auditEvents: input.timeline.length,
        },
        matchedIds: {
            organizationIds: input.organizationIds,
            userIds: uniqueTimelineValues(input.users.map(row => row.id)),
            memberUserIds: uniqueTimelineValues(input.memberships.map(row => row.user_id)),
            inviteIds: uniqueTimelineValues(input.invites.map(row => row.id)),
            requestIds: uniqueTimelineValues([
                ...input.approvalDetails.map(approval => approval.requestId),
                ...input.timeline.map(event => event.requestId),
            ]),
            auditEventIds: input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
        },
        availableActions: {
            inviteAssist: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
            inviteActions: input.invites.map(invite => `/api/admin/support/organizations/${encodeURIComponent(String(invite.organization_id))}/invites/${encodeURIComponent(String(invite.id))}/actions`),
            memberRoleRecovery: input.memberships.map(member => `/api/admin/support/organizations/${encodeURIComponent(String(member.organization_id))}/members/${encodeURIComponent(String(member.user_id))}/role-recovery`),
            accessRecovery: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
            supportSession: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
        },
        audit: {
            filter: input.timelineFilter,
            query: auditQuery,
            details: input.timeline.map(event => event.links?.detail).filter(Boolean),
            redactionRequired: true,
        },
        blockers,
        copyText: [
            `Support inspection search q=${input.q || '*'} org=${input.org || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Organizations: ${input.organizations.length}`,
            `Memberships: ${input.memberships.length}`,
            `Pending invites: ${pendingInvites.length}`,
            `Approvals: ${input.approvalDetails.length}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
            `Audit query: ${auditQuery}`,
        ].join('\n'),
    }
}

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

export function supportInspectionAuditDetailPacket(input: {
    org: string
    user: string
    email: string
    request: string
    supportSession: string
    organizationIds: string[]
    memberships: Array<Record<string, any>>
    invites: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}): SupportInspectionPacket {
    const detailEvents = input.timeline.slice(0, 25).map(event => ({
        id: event.id || null,
        detailRoute: event.id ? `/api/admin/audit-events/${encodeURIComponent(String(event.id))}` : null,
        actionType: event.actionType || null,
        outcome: event.outcome || null,
        severity: event.severity || null,
        requestId: event.requestId || null,
        organizationId: event.organizationId || null,
        targetId: event.targetId || null,
        entityId: event.entityId || null,
        createdAt: event.createdAt || null,
        reasonPresent: Boolean(text(event.reason)),
        links: event.links || {},
    }))
    const memberEntityIds = uniqueTimelineValues(input.memberships.map(member => member.id || member.user_id))
    const inviteEntityIds = uniqueTimelineValues(input.invites.map(invite => invite.id))
    const targetUserIds = uniqueTimelineValues([
        input.user,
        ...input.memberships.map(member => member.user_id),
        ...input.invites.map(invite => invite.user_id),
    ])
    const requestIds = supportInspectionRequestIds(input.request, input.timeline)
    return {
        schemaVersion: 'support.inspection.audit_detail_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        detailEvents,
        detailRoutes: detailEvents.map(event => event.detailRoute).filter(Boolean),
        replayFilters: {
            current: auditFilterQuery(input.timelineFilter),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            request: requestIds.map(requestId => auditFilterQuery({ request: requestId })),
            organization: input.organizationIds.map(organizationId => auditFilterQuery({ org: organizationId })),
            user: targetUserIds.map(userId => auditFilterQuery({ target: userId })),
            member: memberEntityIds.map(entityId => auditFilterQuery({ entity: entityId, entityType: 'member' })),
            invite: inviteEntityIds.map(entityId => auditFilterQuery({ entity: entityId, entityType: 'invite' })),
            supportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession }) : null,
        },
        supportActionRequirements: {
            inviteAssistance: ['reason', 'context', 'scope', 'expiresAt', 'idempotencyKey'],
            accessRecovery: ['reason', 'context', 'scope', 'expiresAt', 'requestId'],
            memberRoleRecovery: ['reason', 'context', 'scope', 'role', 'requestId'],
            impersonation: ['reason', 'context', 'scope', 'durationMinutes', 'targetUserId', 'organizationId'],
        },
        guardrails: {
            supportRoleRequired: true,
            noCrossOrgLeakage: true,
            reasonRequiredForSensitiveActions: true,
            detailRetrievalRequiresSupport: true,
            redactionRequired: true,
        },
        blockers: uniqueTimelineValues([
            detailEvents.length ? '' : 'missing_audit_events',
            input.organizationIds.length || input.supportSession ? '' : 'missing_org_or_support_session_scope',
            ...detailEvents.map(event => event.reasonPresent ? '' : 'missing_reason_on_source_event'),
        ]),
        copyText: [
            `Support inspection audit details org=${input.organizationIds.join(',') || '*'} user=${input.user || '*'} request=${input.request || '*'}`,
            `Detail routes: ${detailEvents.map(event => event.detailRoute).filter(Boolean).join(', ') || 'none'}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
            'Redacted: true',
        ].join('\n'),
    }
}

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

export function supportInspectionRecoveryFixturePacket(input: {
    org: string
    user: string
    email: string
    request: string
    supportSession: string
    accessRecoveryPlan: Record<string, any>
    workbench: Record<string, any>
    timelineFilter: SupportTimelineFilter
}): SupportInspectionPacket {
    const requestId = input.request || 'support-request-id'
    const targetEmail = input.email || 'customer@example.com'
    const targetUserId = input.user || 'target-user-id'
    const reason = 'Verified customer access recovery request with scoped support approval.'
    const supportContext = 'Support case notes, requester verification, and operator identity.'
    const planItems = Array.isArray(input.accessRecoveryPlan.items) ? input.accessRecoveryPlan.items : []
    const fixtures = planItems.flatMap((item: Record<string, any>) => {
        const organizationId = text(item.organizationId || input.org) || 'organization-id'
        const operations = item.guardedOperations || {}
        const pendingInvite = item.inviteState?.pending?.[0] || null
        const inviteId = text(pendingInvite?.id) || 'invite-id'
        const baseBody = {
            reason,
            context: supportContext,
            requestId,
            supportSessionId: input.supportSession || undefined,
        }
        return [
            {
                name: 'invite_resend_prepare',
                method: 'POST',
                route: operations.inviteResend?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
                body: {
                    ...baseBody,
                    action: 'resend',
                    scope: 'invite:resend',
                    idempotencyKey: `support-${organizationId}-invite-resend`,
                },
                available: Boolean(operations.inviteResend?.available),
                expectedAuditAction: 'support.organization.invite_resend',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.invite_resend', request: requestId, entity: inviteId }),
            },
            {
                name: 'invite_revoke_prepare',
                method: 'POST',
                route: operations.inviteRevoke?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
                body: {
                    ...baseBody,
                    action: 'revoke',
                    scope: 'invite:revoke',
                    idempotencyKey: `support-${organizationId}-invite-revoke`,
                },
                available: Boolean(operations.inviteRevoke?.available),
                expectedAuditAction: 'support.organization.invite_revoke',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.invite_revoke', request: requestId, entity: inviteId }),
            },
            {
                name: 'controlled_recovery_invite_prepare',
                method: 'POST',
                route: operations.controlledRecoveryInvite?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery`,
                body: {
                    ...baseBody,
                    email: targetEmail,
                    role: 'admin',
                    scope: 'recovery:invite',
                    expiresAt: 'future ISO timestamp',
                },
                available: Boolean(operations.controlledRecoveryInvite?.available),
                expectedAuditAction: 'support.organization.access_recovery',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.access_recovery', request: requestId, target: targetEmail }),
            },
            {
                name: 'member_role_recovery_prepare',
                method: 'POST',
                route: operations.memberRoleRecovery?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(targetUserId)}/role-recovery`,
                body: {
                    ...baseBody,
                    role: 'admin',
                    scope: 'member:role_recovery',
                },
                available: Boolean(operations.memberRoleRecovery?.available),
                expectedAuditAction: 'support.organization.member_role_recovery',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.member_role_recovery', request: requestId, target: targetUserId }),
            },
        ]
    })
    const impersonationFixture = {
        name: 'impersonation_prepare',
        method: 'POST',
        route: '/api/impersonation/start',
        body: {
            reason,
            context: supportContext,
            requestId,
            targetUserId,
            organizationId: input.org || input.accessRecoveryPlan.target?.organizationIds?.[0] || 'organization-id',
            scope: ['read_profile', 'read_org'],
            durationMinutes: 30,
            supportSessionId: input.supportSession || undefined,
        },
        available: Boolean(input.workbench.impersonationAssistance?.eligible),
        expectedAuditAction: 'impersonation.start',
        auditReplay: auditFilterQuery({ action: 'impersonation.start', request: requestId, target: targetUserId }),
    }
    const allFixtures = [...fixtures, impersonationFixture]
    return {
        schemaVersion: 'support.inspection.recovery_fixture_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        purpose: 'support_workbench_recovery_and_impersonation_validation',
        target: {
            organizationIds: input.accessRecoveryPlan.target?.organizationIds || [],
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        requiredFields: ['reason', 'context', 'scope', 'requestId', 'idempotencyKey|durationMinutes|expiresAt'],
        fixtures: allFixtures,
        audit: {
            currentReplay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            expectedActions: uniqueTimelineValues(allFixtures.map(fixture => fixture.expectedAuditAction)),
            expectedRequestId: requestId,
        },
        blockers: uniqueTimelineValues([
            planItems.length ? '' : 'missing_access_recovery_plan_items',
            allFixtures.some(fixture => fixture.available) ? '' : 'no_available_support_recovery_action',
            ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        ]),
        copyText: [
            `Support recovery fixtures request=${requestId} user=${input.user || '*'} email=${input.email || '*'}`,
            `Fixtures: ${allFixtures.map(fixture => fixture.name).join(', ')}`,
            `Expected actions: ${uniqueTimelineValues(allFixtures.map(fixture => fixture.expectedAuditAction)).join(', ')}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}

export function supportInspectionAuditFilterCoverage(input: {
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    organizationIds: string[]
    user: string
    email: string
    request: string
    supportSession: string
}): SupportInspectionPacket {
    const filterEntries = Object.entries(input.timelineFilter)
        .filter(([key, value]) => key !== 'unsupported' && key !== 'limit' && value !== undefined && value !== null && value !== '')
        .map(([key, value]) => ({ key, value: String(value) }))
    const activeKeys = filterEntries.map(entry => entry.key)
    const targetBounded = Boolean(input.timelineFilter.org || input.timelineFilter.user || input.timelineFilter.email || input.timelineFilter.request || input.timelineFilter.entity || input.timelineFilter.supportSession)
    const detailRoutes = input.timeline.map(event => event.links?.detail).filter(Boolean)
    const eventIds = input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const actionValues = uniqueTimelineValues(input.timeline.map(event => event.action || event.actionType))
    const outcomeValues = uniqueTimelineValues(input.timeline.map(event => event.outcome))
    const severityValues = uniqueTimelineValues(input.timeline.map(event => event.severity))
    const entityIds = uniqueTimelineValues(input.timeline.map(event => event.entityId || event.entity?.id))
    const requestIds = supportInspectionRequestIds(input.request, input.timeline)
    return {
        schemaVersion: 'support.inspection.audit_filter_coverage.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportedFilters: Array.from(supportInspectionFilters),
        activeFilters: filterEntries,
        activeKeys,
        unsupportedFilters: input.timelineFilter.unsupported,
        targetBounded,
        requiredForBoundedSearch: ['org|user|email|request|entity|supportSession'],
        resultCoverage: {
            eventCount: input.timeline.length,
            eventIds,
            actionValues,
            outcomeValues,
            severityValues,
            entityIds,
            requestIds,
            detailRoutes,
        },
        replay: {
            current: auditFilterQuery(input.timelineFilter),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            success: auditFilterQuery({ ...input.timelineFilter, outcome: 'success' }),
            byRequest: requestIds.map(requestId => auditFilterQuery({ request: requestId })),
            byOrg: input.organizationIds.map(org => auditFilterQuery({ org })),
            byTarget: input.user || input.email ? auditFilterQuery({ target: input.user || input.email }) : null,
            bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession }) : null,
            byEntity: entityIds.map(entity => auditFilterQuery({ entity })),
            byActionOutcome: actionValues.flatMap(action => outcomeValues.map(outcome => auditFilterQuery({ action, outcome }))).slice(0, 25),
        },
        guardrails: {
            supportRoleRequired: true,
            detailRetrievalRequiresSupport: true,
            noOverbroadInspection: true,
            redactionRequired: true,
            unsupportedFiltersAreTyped: true,
        },
        blockers: uniqueTimelineValues([
            targetBounded ? '' : 'overbroad_support_inspection',
            input.timelineFilter.unsupported.length ? 'unsupported_audit_filter' : '',
            input.timeline.length ? '' : 'missing_audit_events',
            detailRoutes.length ? '' : 'missing_detail_routes',
        ]),
        copyText: [
            `Support audit filters active=${activeKeys.join(',') || 'none'} targetBounded=${targetBounded}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
            `Denied: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}

export function supportInspectionActionAuditContract(input: {
    recoveryFixturePacket: Record<string, any>
    timelineFilter: SupportTimelineFilter
    organizationIds: string[]
    user: string
    email: string
    request: string
    supportSession: string
}): SupportInspectionPacket {
    const fixtures = Array.isArray(input.recoveryFixturePacket.fixtures) ? input.recoveryFixturePacket.fixtures : []
    const requestId = input.request || input.recoveryFixturePacket.audit?.expectedRequestId || 'support-request-id'
    const actionContracts = fixtures.map((fixture: Record<string, any>) => {
        const actionType = text(fixture.expectedAuditAction)
        const body = fixture.body && typeof fixture.body === 'object' ? fixture.body as Record<string, any> : {}
        const organizationId = text(body.organizationId || input.organizationIds[0])
        const targetId = text(body.targetUserId || body.email || input.user || input.email)
        const entityId = text(body.inviteId || body.targetUserId || body.email || targetId)
        const isImpersonation = actionType.startsWith('impersonation.')
        const isInvite = actionType.includes('invite')
        const isMember = actionType.includes('member')
        return {
            name: fixture.name || actionType || 'support_action',
            actionType,
            method: fixture.method || 'POST',
            route: fixture.route || null,
            available: Boolean(fixture.available),
            expectedOutcome: fixture.available ? 'success' : 'denied',
            severity: isImpersonation || actionType.includes('access_recovery') ? 'warning' : 'notice',
            targetType: isImpersonation ? 'user' : isInvite ? 'invite' : isMember ? 'member' : 'organization',
            targetId: targetId || null,
            organizationId: organizationId || null,
            entityId: entityId || null,
            requiredReason: Boolean(body.reason),
            requiredContext: Boolean(body.context),
            requiredScope: Boolean(body.scope),
            requiredDurationOrExpiry: Boolean(body.durationMinutes || body.expiresAt),
            requiredIdempotency: Boolean(body.idempotencyKey || isImpersonation),
            requiredAuditFields: ['actionType', 'actorId', 'targetType', 'targetId', 'organizationId', 'entityId', 'requestId', 'severity', 'outcome', 'reason', 'context.schemaVersion', 'context.scope'],
            requiredContextFields: ['schemaVersion', 'requestId', 'supportContext', 'scope', 'supportSessionId', 'redactionRequired'],
            replay: {
                fixture: fixture.auditReplay || auditFilterQuery({ action: actionType, request: requestId, target: targetId }),
                success: auditFilterQuery({ action: actionType, request: requestId, outcome: 'success' }),
                denied: auditFilterQuery({ action: actionType, request: requestId, outcome: 'denied' }),
                target: targetId ? auditFilterQuery({ target: targetId, action: actionType }) : null,
            },
            creationPreview: {
                actionType,
                actorId: 'support-actor-id',
                targetType: isImpersonation ? 'user' : isInvite ? 'invite' : isMember ? 'member' : 'organization',
                targetId: targetId || 'target-id',
                organizationId: organizationId || null,
                entityId: entityId || targetId || null,
                requestId,
                severity: isImpersonation || actionType.includes('access_recovery') ? 'warning' : 'notice',
                outcome: fixture.available ? 'success' : 'denied',
                reason: body.reason || 'Required support reason.',
                context: {
                    schemaVersion: actionType ? `${actionType}.audit.v1` : 'support.action.audit.v1',
                    requestId,
                    supportContext: body.context || 'Required support context.',
                    scope: body.scope || null,
                    supportSessionId: input.supportSession || body.supportSessionId || null,
                    noSilentMembershipMutation: true,
                    redactionRequired: true,
                },
            },
        }
    })
    const missingReasonActions = actionContracts.filter(contract => !contract.requiredReason).map(contract => contract.actionType)
    const missingContextActions = actionContracts.filter(contract => !contract.requiredContext).map(contract => contract.actionType)
    const missingScopeActions = actionContracts.filter(contract => !contract.requiredScope).map(contract => contract.actionType)
    return {
        schemaVersion: 'support.inspection.action_audit_contract.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        actionContracts,
        requiredForEverySensitiveAction: {
            supportRole: true,
            reason: true,
            context: true,
            scope: true,
            requestId: true,
            actorIdentity: true,
            targetIdentity: true,
            immutableAuditEvent: true,
        },
        audit: {
            currentReplay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            actionReplays: actionContracts.map(contract => contract.replay.fixture),
            expectedActions: uniqueTimelineValues(actionContracts.map(contract => contract.actionType)),
            expectedRequestId: requestId,
        },
        blockers: uniqueTimelineValues([
            actionContracts.length ? '' : 'missing_support_action_fixtures',
            missingReasonActions.length ? 'missing_reason_on_fixture' : '',
            missingContextActions.length ? 'missing_context_on_fixture' : '',
            missingScopeActions.length ? 'missing_scope_on_fixture' : '',
        ]),
        copyText: [
            `Support action audit contract request=${requestId}`,
            `Actions: ${uniqueTimelineValues(actionContracts.map(contract => contract.actionType)).join(', ') || 'none'}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}
