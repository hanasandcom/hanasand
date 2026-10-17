import { auditFilterQuery, uniqueTimelineValues, type SupportInspectionPacket, type SupportTimelineFilter } from './inspectionPacketShared.ts'
import { supportText as text } from './adminSupportInput.ts'

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
