import type { OrganizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { buildRecoveryEligibility } from './subjectMapping.ts'
import { buildSupportAccessStatus } from './accessStatus.ts'
import { buildSupportAccessRecoveryPlan } from './accessRecoveryPlan.ts'
import { buildSupportInspectionAuthorization } from './inspection/authorization.ts'
import { supportTimelineFilter } from './inspection/timelineFilter.ts'
import type { SupportSubjectInspectionKind } from './subjectInspectionTypes.ts'

export function buildSupportSubjectAccessState(input: {
    kind: SupportSubjectInspectionKind
    targetId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    availabilityByOrg: Map<string, OrganizationMembershipAvailability>
    timeline: Array<Record<string, any>>
}) {
    const org = input.kind === 'organization' ? input.targetId : ''
    const user = input.kind === 'user' ? input.targetId : ''
    const timelineFilter = supportTimelineFilter({
        q: '', org, user, email: '', request: input.requestId, entity: input.targetId,
        entityType: input.kind, supportSession: '', action: `support.${input.kind}`,
        severity: '', outcome: '', source: 'admin', service: 'hanasand-api', blocker: '',
        reason: input.reason, context: input.supportContext, from: '', to: '', limit: 25,
    })
    const recoveryEligibility = buildRecoveryEligibility({
        email: '', user, organizationIds: input.organizationIds,
        memberships: input.memberships, users: input.users,
        availabilityByOrg: input.availabilityByOrg, invites: input.invites,
    })
    const accessStatus = buildSupportAccessStatus({
        org, user, email: '', request: input.requestId, organizationIds: input.organizationIds,
        users: input.users, memberships: input.memberships, invites: input.invites,
        approvalDetails: input.approvalDetails, recoveryEligibility,
        availabilityByOrg: input.availabilityByOrg, timeline: input.timeline,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org, user, email: '', request: input.requestId, organizationIds: input.organizationIds,
        memberships: input.memberships, invites: input.invites,
        approvalDetails: input.approvalDetails, recoveryEligibility,
        availabilityByOrg: input.availabilityByOrg, timeline: input.timeline, timelineFilter,
    })
    return { timelineFilter, recoveryEligibility, accessStatus, accessRecoveryPlan }
}

export function buildSupportSubjectInspectionAuthorization(input: {
    kind: SupportSubjectInspectionKind
    actorId: string
    requestedId: string
    targetId: string
    organizationIds: string[]
    requestId: string
}) {
    const organization = input.kind === 'organization'
    return buildSupportInspectionAuthorization({
        actorId: input.actorId,
        requestedOrg: organization ? input.requestedId : '',
        requestedUser: organization ? '' : input.requestedId,
        effectiveOrg: organization ? input.targetId : '',
        effectiveUser: organization ? '' : input.targetId,
        email: '',
        request: input.requestId,
        entity: input.targetId,
        supportSession: '',
        sessionState: null,
        organizationIds: input.organizationIds,
    })
}
