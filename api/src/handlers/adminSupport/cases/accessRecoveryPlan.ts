import type { OrganizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditFilterContract } from '../audit/auditFilterPackets.ts'
import { toSupportMemberDetail, toSupportInvite } from './subjectMapping.ts'
import { auditTimelineLink } from '../audit/auditLinks.ts'

export function buildSupportAccessRecoveryPlan(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    recoveryEligibility: Array<Record<string, any>>
    availabilityByOrg: Map<string, OrganizationMembershipAvailability>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const planItems = input.organizationIds.map((organizationId) => {
        const availability = input.availabilityByOrg.get(organizationId) || {
            organizationId,
            ownerCount: 0,
            activeOwnerCount: 0,
            adminCount: 0,
            activeAdminCount: 0,
            hasAvailableOwner: false,
            hasAvailableAdmin: false,
        }
        const memberships = input.memberships.filter(row => row.organization_id === organizationId)
        const activeMembers = memberships.filter(row => row.status === 'active')
        const removedMembers = memberships.filter(row => row.status === 'removed')
        const targetMembership = memberships.find(row => !input.user || row.user_id === input.user)
        const invites = input.invites.filter(row => row.organization_id === organizationId)
        const pendingInvites = invites.filter(row => row.status === 'pending')
        const revokedInvites = invites.filter(row => row.status === 'revoked')
        const expiredInvites = invites.filter(row => row.status === 'expired')
        const approvals = input.approvalDetails.filter(approval => approval.organizationId === organizationId)
        const openApprovals = approvals.filter(approval => ['pending', 'not_required'].includes(String(approval.status || '')))
        const eligibility = input.recoveryEligibility.find(item => item.organizationId === organizationId) || null
        const noAvailableAdmin = !availability.hasAvailableAdmin
        const targetRemoved = Boolean(targetMembership && targetMembership.status === 'removed')
        const targetEmailMissing = !input.email && !input.user
        const inviteAssistAvailable = Boolean(input.email && pendingInvites.length)
        const controlledInviteAvailable = Boolean(input.email && eligibility?.canCreateControlledInvite)
        const roleCorrectionAvailable = Boolean(input.user && targetMembership && targetMembership.status !== 'active')
        const recommendedActions = uniqueTimelineValues([
            inviteAssistAvailable ? 'resend_pending_invite' : '',
            revokedInvites.length || expiredInvites.length ? 'review_invite_recovery' : '',
            controlledInviteAvailable && (noAvailableAdmin || targetRemoved || !pendingInvites.length) ? 'create_controlled_recovery_invite' : '',
            roleCorrectionAvailable ? 'member_role_recovery' : '',
            noAvailableAdmin ? 'access_recovery_approval' : '',
        ])
        const blockers = uniqueTimelineValues([
            targetEmailMissing ? 'missing_user_or_email' : '',
            noAvailableAdmin ? '' : 'active_admin_available',
            controlledInviteAvailable ? '' : 'recovery_unavailable',
            input.organizationIds.length > 1 && !input.org ? 'ambiguous_org_target' : '',
        ])
        return {
            schemaVersion: 'support.access_recovery.plan_item.v1',
            organizationId,
            targetUserId: input.user || null,
            targetEmail: input.email || null,
            adminAvailability: availability,
            memberState: {
                activeMemberCount: activeMembers.length,
                removedMemberCount: removedMembers.length,
                targetMembership: targetMembership ? toSupportMemberDetail(targetMembership) : null,
            },
            inviteState: {
                pending: pendingInvites.map(toSupportInvite),
                revoked: revokedInvites.map(toSupportInvite),
                expired: expiredInvites.map(toSupportInvite),
            },
            approvalState: {
                openRequests: openApprovals.map(approval => ({
                    requestId: approval.requestId,
                    status: approval.status,
                    outcome: approval.outcome,
                    approvalRequired: approval.approvalRequired,
                    auditEventIds: approval.auditEventIds || [],
                })),
                allRequestIds: approvals.map(approval => approval.requestId).filter(Boolean),
            },
            recommendedActions,
            guardedOperations: {
                inviteResend: {
                    available: inviteAssistAvailable,
                    route: pendingInvites[0]?.id ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(String(pendingInvites[0].id))}/actions` : null,
                    required: ['reason', 'context', 'scope', 'idempotencyKey'],
                },
                inviteRevoke: {
                    available: Boolean(pendingInvites.length),
                    route: pendingInvites[0]?.id ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(String(pendingInvites[0].id))}/actions` : null,
                    required: ['reason', 'context', 'scope', 'idempotencyKey'],
                },
                controlledRecoveryInvite: {
                    available: controlledInviteAvailable,
                    route: `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery`,
                    required: ['reason', 'context', 'expiresAt', 'requestId'],
                },
                memberRoleRecovery: {
                    available: roleCorrectionAvailable,
                    route: input.user ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(input.user)}/role-recovery` : null,
                    required: ['reason', 'context', 'role', 'requestId'],
                },
            },
            blockers,
            audit: {
                eventIds: input.timeline
                    .filter(event => event.organization?.id === organizationId || event.organizationId === organizationId)
                    .map(event => event.id)
                    .filter((id): id is number => Number.isFinite(id)),
                links: {
                    timeline: auditTimelineLink({ org: organizationId, target: input.user || input.email, request: input.request }),
                    inviteAssistance: auditTimelineLink({ org: organizationId, target: input.email, request: input.request, action: 'invite' }),
                    accessRecovery: auditTimelineLink({ org: organizationId, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
                    memberRoleRecovery: auditTimelineLink({ org: organizationId, target: input.user, request: input.request, action: 'member_role_recovery' }),
                },
                redacted: true,
            },
        }
    })
    const blockers = uniqueTimelineValues([
        input.organizationIds.length ? '' : 'missing_org_target',
        input.user || input.email ? '' : 'missing_user_or_email',
        input.organizationIds.length > 1 && !input.org ? 'ambiguous_org_target' : '',
        ...planItems.flatMap(item => item.blockers),
    ])
    return {
        schemaVersion: 'support.access_recovery.plan.v1',
        generatedAt: new Date().toISOString(),
        noMutation: true,
        supportRoleRequired: true,
        reasonRequiredForActions: true,
        contextRequiredForActions: true,
        scopedActionRequired: true,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        filters: input.timelineFilter,
        items: planItems,
        audit: {
            eventIds: input.timeline.map(event => event.id),
            timeline: auditFilterQuery(input.timelineFilter),
            filterContract: supportAuditFilterContract(input.timelineFilter, input.timeline),
            redacted: true,
        },
        blockers,
        copyText: [
            `Access recovery plan org=${input.org || input.organizationIds.join(',') || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Organizations: ${planItems.length}`,
            `Recommended actions: ${uniqueTimelineValues(planItems.flatMap(item => item.recommendedActions)).join(', ') || 'none'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
            `Audit replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}
