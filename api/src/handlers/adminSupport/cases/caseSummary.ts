import type { OrganizationRow } from '#utils/organizations.ts'
import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { toOrganization } from '#utils/organizations.ts'
import { toSupportUser, toSupportMemberDetail, toSupportInvite } from './subjectMapping.ts'
import { auditTimelineLink } from '../audit/auditLinks.ts'

export function buildSupportCaseSummary(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    organizations: Record<string, unknown>[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    recoveryEligibility: Array<Record<string, unknown>>
    accessStatus: Record<string, any>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const pendingInvites = input.invites.filter(row => row.status === 'pending')
    const activeMemberships = input.memberships.filter(row => row.status === 'active')
    const removedMemberships = input.memberships.filter(row => row.status === 'removed')
    const recoveryRequests = input.approvalDetails.map(approval => ({
        requestId: approval.requestId,
        organizationId: approval.organizationId,
        inviteId: approval.inviteId,
        targetUserId: approval.targetUserId,
        status: approval.status,
        outcome: approval.outcome,
        approvalRequired: approval.approvalRequired,
        auditEventIds: approval.auditEventIds || [],
        audit: approval.audit,
    }))
    const impersonationEvents = input.timeline
        .filter(event => String(event.action || '').startsWith('impersonation.'))
        .map(event => ({
            id: event.id,
            action: event.action,
            outcome: event.outcome,
            severity: event.severity,
            requestId: event.requestId,
            targetUserId: event.target?.id || event.entityId,
            durationMinutes: event.context?.durationMinutes ?? null,
            scope: event.context?.scope ?? null,
            expiresAt: event.context?.expiresAt ?? null,
            createdAt: event.createdAt,
            audit: auditTimelineLink({
                request: event.requestId,
                action: event.action,
                outcome: event.outcome,
            }),
        }))
    const target = {
        organizationIds: input.organizationIds,
        userId: input.user || null,
        email: input.email || null,
        requestId: input.request || null,
    }
    const blockers = [
        input.organizationIds.length ? '' : 'organization_not_identified',
        input.user || input.email ? '' : 'user_or_email_not_identified',
        input.timeline.length ? '' : 'no_timeline_events_matched',
    ].filter(Boolean)
    const nextActions = {
        inspectAuditTimeline: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request }),
        impersonationTimeline: auditTimelineLink({ target: input.user, request: input.request, action: 'impersonation' }),
        inviteAssist: {
            available: Boolean(input.organizationIds.length && input.email),
            reasonRequired: true,
            scopeRequired: true,
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
        },
        accessRecovery: {
            available: Boolean(input.organizationIds.length && (input.email || input.user)),
            reasonRequired: true,
            expiryRequired: true,
            approvalState: recoveryRequests[0]?.status || 'not_requested',
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
        },
        impersonationRequest: {
            available: Boolean(input.user),
            reasonRequired: true,
            scopeRequired: true,
            durationRequired: true,
            approvalState: 'not_required',
            endpoint: '/api/impersonation/start',
        },
    }

    return {
        schemaVersion: 'support.case_summary.v1',
        target,
        state: {
            organizations: input.organizations.map(row => toOrganization(row as OrganizationRow)),
            users: input.users.map(toSupportUser),
            activeMembershipCount: activeMemberships.length,
            removedMembershipCount: removedMemberships.length,
            pendingInviteCount: pendingInvites.length,
            recoveryRequestCount: recoveryRequests.length,
            impersonationEventCount: impersonationEvents.length,
            memberships: input.memberships.map(toSupportMemberDetail),
            pendingInvites: pendingInvites.map(toSupportInvite),
            recoveryRequests,
            impersonationRequests: impersonationEvents,
            accessStatus: input.accessStatus,
        },
        recoveryEligibility: input.recoveryEligibility,
        nextActions,
        audit: {
            eventIds: input.timeline.map(event => event.id),
            timelineQuery: nextActions.inspectAuditTimeline.api,
            impersonationTimelineQuery: nextActions.impersonationTimeline.api,
            filter: input.timelineFilter,
            redacted: true,
        },
        blockers,
        copyText: [
            `Support case summary org=${input.org || input.organizationIds.join(',') || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Memberships: active=${activeMemberships.length} removed=${removedMemberships.length}`,
            `Pending invites: ${pendingInvites.length}`,
            `Recovery requests: ${recoveryRequests.length}`,
            `Impersonation events: ${impersonationEvents.length}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
        ].join('\n'),
    }
}
