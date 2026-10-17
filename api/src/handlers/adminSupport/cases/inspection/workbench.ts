import { isAccountUnavailable } from '#utils/accountAvailability.ts'
import { uniqueTimelineValues, type SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import type { OrganizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { toSupportInvite } from '../subjectMapping.ts'
import { auditTimelineLink } from '../../audit/auditLinks.ts'
import { buildSupportActionPreparation } from './actionPreparation.ts'
import { supportWorkbenchReadinessProof } from './workbenchReadinessProof.ts'
import type { SupportActionPreparationInput } from './inspectionActionPreparation.ts'

export function buildSupportWorkbench(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    recoveryEligibility: Array<Record<string, any>>
    caseSummary: Record<string, any>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
    preparationInput?: SupportActionPreparationInput | null
}) {
    const activeMemberships = input.memberships.filter(row => row.status === 'active')
    const inactiveMemberships = input.memberships.filter(row => row.status !== 'active')
    const pendingInvites = input.invites.filter(row => row.status === 'pending')
    const targetUser = input.users.find(row => row.id === input.user)
    const userInactive = Boolean(targetUser && isAccountUnavailable(targetUser))
    const noAdminAvailable = input.recoveryEligibility.some(item => {
        const availability = item.adminAvailability as OrganizationMembershipAvailability | undefined
        return availability && !availability.hasAvailableAdmin
    })
    const ambiguousTarget = input.organizationIds.length > 1 && !input.org
    const recoveryAvailable = input.recoveryEligibility.some(item => item.canCreateControlledInvite)
    const inviteAssistAvailable = Boolean(input.organizationIds.length && input.email)
    const impersonationEligible = Boolean(input.user && !userInactive)
    const blockers = uniqueTimelineValues([
        input.organizationIds.length ? '' : 'missing_org_target',
        input.user || input.email ? '' : 'missing_user_target',
        ambiguousTarget ? 'ambiguous_target' : '',
        inactiveMemberships.length ? 'inactive_member' : '',
        noAdminAvailable ? 'no_admin_available' : '',
        recoveryAvailable ? '' : 'recovery_unavailable',
        impersonationEligible ? '' : 'impersonation_ineligible',
        input.timelineFilter.unsupported.length ? 'audit_filter_unavailable' : '',
    ])
    const inviteAssistBlockers = uniqueTimelineValues([
        inviteAssistAvailable ? '' : 'missing_org_or_email',
        ambiguousTarget ? 'ambiguous_target' : '',
    ])
    const accessRecoveryBlockers = uniqueTimelineValues([
        recoveryAvailable ? '' : 'recovery_unavailable',
        ambiguousTarget ? 'ambiguous_target' : '',
        input.user || input.email ? '' : 'missing_user_target',
    ])
    const impersonationBlockers = uniqueTimelineValues([
        input.user ? '' : 'missing_user_target',
        userInactive ? 'inactive_user' : '',
    ])
    const actionPreparation = input.preparationInput
        ? buildSupportActionPreparation({
            input: input.preparationInput,
            organizationIds: input.organizationIds,
            user: input.user,
            email: input.email,
            request: input.request,
            inviteAssistBlockers,
            accessRecoveryBlockers,
            impersonationBlockers,
            noAdminAvailable,
            timeline: input.timeline,
        })
        : {
            schemaVersion: 'support.action_prepare.v1',
            requested: false,
            supportedActions: ['invite_assist', 'access_recovery', 'impersonation'],
            reasonRequired: true,
            contextRequired: true,
            scopeRequired: true,
            durationRequiredFor: ['impersonation'],
            expiryRelevantFor: ['invite_assist', 'access_recovery'],
        }
    const readinessProof = supportWorkbenchReadinessProof({
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        organizationIds: input.organizationIds,
        activeMembershipCount: activeMemberships.length,
        pendingInviteCount: pendingInvites.length,
        noAdminAvailable,
        inviteAssistAvailable,
        recoveryAvailable,
        impersonationEligible,
        timeline: input.timeline,
        timelineFilter: input.timelineFilter,
        blockers,
        inviteAssistBlockers,
        accessRecoveryBlockers,
        impersonationBlockers,
        actionPreparation,
    })

    return {
        schemaVersion: 'support.workbench.v1',
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            ambiguous: ambiguousTarget,
        },
        state: {
            activeMembershipCount: activeMemberships.length,
            inactiveMembershipCount: inactiveMemberships.length,
            pendingInviteCount: pendingInvites.length,
            recoveryRequestCount: input.caseSummary.state?.recoveryRequestCount || 0,
            impersonationEventCount: input.caseSummary.state?.impersonationEventCount || 0,
            userInactive,
            noAdminAvailable,
        },
        inviteAssistance: {
            available: inviteAssistAvailable && !ambiguousTarget,
            reasonRequired: true,
            contextRequired: true,
            scope: {
                organizationIds: input.organizationIds,
                email: input.email || null,
                inviteIds: input.invites.map(row => row.id).filter(Boolean),
            },
            blockers: inviteAssistBlockers,
            pendingInvites: pendingInvites.map(toSupportInvite),
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
            audit: auditTimelineLink({ org: input.org, target: input.email, request: input.request, action: 'invite_assist' }),
        },
        accessRecovery: {
            available: recoveryAvailable && !ambiguousTarget,
            reasonRequired: true,
            contextRequired: true,
            expiryRequired: true,
            approvalState: input.caseSummary.nextActions?.accessRecovery?.approvalState || 'not_requested',
            options: input.recoveryEligibility,
            blockers: accessRecoveryBlockers,
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
            audit: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
        },
        impersonationAssistance: {
            eligible: impersonationEligible,
            reasonRequired: true,
            contextRequired: true,
            scopeRequired: true,
            durationRequired: true,
            targetUserId: input.user || null,
            organizationIds: input.organizationIds,
            blockers: impersonationBlockers,
            endpoint: '/api/impersonation/start',
            audit: auditTimelineLink({ target: input.user, request: input.request, action: 'impersonation' }),
        },
        timelineProof: {
            schemaVersion: 'support.workbench.timeline_proof.v1',
            filter: input.timelineFilter,
            eventIds: input.timeline.map(event => event.id),
            inviteAssistance: auditTimelineLink({ org: input.org, target: input.email, request: input.request, action: 'invite_assist' }),
            accessRecovery: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
            impersonation: auditTimelineLink({ target: input.user, request: input.request, action: 'impersonation' }),
            redacted: true,
        },
        actionPreparation,
        readinessProof,
        blockers,
        copyText: [
            `Support workbench org=${input.org || input.organizationIds.join(',') || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Invite assist: ${inviteAssistAvailable && !ambiguousTarget ? 'available' : inviteAssistBlockers.join(',') || 'blocked'}`,
            `Access recovery: ${recoveryAvailable && !ambiguousTarget ? 'available' : accessRecoveryBlockers.join(',') || 'blocked'}`,
            `Impersonation: ${impersonationEligible ? 'eligible' : impersonationBlockers.join(',') || 'ineligible'}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
        ].join('\n'),
    }
}
