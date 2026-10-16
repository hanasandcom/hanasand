import type { OrganizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { isAccountAvailable, isAccountUnavailable } from '#utils/accountAvailability.ts'
import { uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { auditTimelineLink } from '../audit/auditLinks.ts'

export function buildSupportAccessStatus(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    recoveryEligibility: Array<Record<string, any>>
    availabilityByOrg: Map<string, OrganizationMembershipAvailability>
    timeline: Array<Record<string, any>>
}) {
    const activeMemberships = input.memberships.filter(row => row.status === 'active')
    const removedMemberships = input.memberships.filter(row => row.status === 'removed')
    const inactiveMemberships = input.memberships.filter(row => row.status !== 'active')
    const pendingInvites = input.invites.filter(row => row.status === 'pending')
    const revokedInvites = input.invites.filter(row => row.status === 'revoked')
    const expiredInvites = input.invites.filter(row => row.expires_at && Date.parse(String(row.expires_at)) <= Date.now())
    const activeUsers = input.users.filter(row => isAccountAvailable(row))
    const blockedUsers = input.users.filter(row => isAccountUnavailable(row))
    const adminAvailable = input.organizationIds.some(id => input.availabilityByOrg.get(id)?.hasAvailableAdmin === true)
    const recoveryRecommended = input.recoveryEligibility.some(item => item.recommended === true)
    const openRecoveryRequests = input.approvalDetails.filter(item => ['pending', 'approved'].includes(String(item.status || '')))
    const overall = activeMemberships.length && activeUsers.length
        ? 'active_access'
        : pendingInvites.length
            ? 'invite_pending'
            : recoveryRecommended || removedMemberships.length || blockedUsers.length
                ? 'recovery_recommended'
                : 'access_unknown'
    const blockers = uniqueTimelineValues([
        input.organizationIds.length ? '' : 'missing_org_target',
        input.user || input.email ? '' : 'missing_user_or_email',
        adminAvailable ? 'active_admin_available' : '',
        blockedUsers.length ? 'user_deactivated' : '',
        removedMemberships.length ? 'member_removed' : '',
        expiredInvites.length ? 'invite_expired' : '',
        revokedInvites.length ? 'invite_revoked' : '',
    ])
    return {
        schemaVersion: 'support.access_status.v1',
        overall,
        generatedAt: new Date().toISOString(),
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        counts: {
            activeMemberships: activeMemberships.length,
            inactiveMemberships: inactiveMemberships.length,
            removedMemberships: removedMemberships.length,
            pendingInvites: pendingInvites.length,
            revokedInvites: revokedInvites.length,
            expiredInvites: expiredInvites.length,
            openRecoveryRequests: openRecoveryRequests.length,
            relatedAuditEvents: input.timeline.length,
        },
        adminAvailability: input.organizationIds.map(id => input.availabilityByOrg.get(id) || {
            organizationId: id,
            ownerCount: 0,
            activeOwnerCount: 0,
            adminCount: 0,
            activeAdminCount: 0,
            hasAvailableOwner: false,
            hasAvailableAdmin: false,
        }),
        recovery: {
            recommended: recoveryRecommended,
            eligibility: input.recoveryEligibility,
            openRequests: openRecoveryRequests.map(item => ({
                requestId: item.requestId,
                status: item.status,
                outcome: item.outcome,
                approvalRequired: item.approvalRequired,
                auditEventIds: item.auditEventIds || [],
            })),
        },
        audit: {
            eventIds: input.timeline.map(event => event.id),
            links: {
                timeline: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request }),
                inviteAssistance: auditTimelineLink({ org: input.org, target: input.email, request: input.request, action: 'invite_assist' }),
                accessRecovery: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
            },
            redacted: true,
        },
        blockers,
        noMutation: true,
        copyText: [
            `Access status: ${overall}`,
            `Active memberships: ${activeMemberships.length}`,
            `Pending invites: ${pendingInvites.length}`,
            `Open recovery requests: ${openRecoveryRequests.length}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
        ].join('\n'),
    }
}
