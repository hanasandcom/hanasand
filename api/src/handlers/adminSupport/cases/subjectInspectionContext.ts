import type { OrganizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { buildSupportSubjectAccessState } from './subjectAccessState.ts'
import { buildSupportSubjectInspectionAuthorization } from './subjectAccessState.ts'
import { buildSupportSubjectInspectionReceipts } from './subjectInspectionReceipts.ts'
import type { SupportSubjectInspectionKind } from './subjectInspectionTypes.ts'

export function buildSupportSubjectInspectionContext(input: {
    kind: SupportSubjectInspectionKind
    actorId: string
    requestedId: string
    targetId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    availability: OrganizationMembershipAvailability[]
    timeline: Array<Record<string, any>>
    supportActivityRollup: Record<string, any>
}) {
    const subjectAccessState = buildSupportSubjectAccessState({
        kind: input.kind,
        targetId: input.targetId,
        organizationIds: input.organizationIds,
        requestId: input.requestId,
        reason: input.reason,
        supportContext: input.supportContext,
        users: input.users,
        memberships: input.memberships,
        invites: input.invites,
        approvalDetails: input.approvalDetails,
        availabilityByOrg: new Map(input.availability.map(item => [item.organizationId, item])),
        timeline: input.timeline,
    })
    const authorization = buildSupportSubjectInspectionAuthorization({
        kind: input.kind,
        actorId: input.actorId,
        requestedId: input.requestedId,
        targetId: input.targetId,
        organizationIds: input.organizationIds,
        requestId: input.requestId,
    })
    const receipts = buildSupportSubjectInspectionReceipts({
        kind: input.kind,
        actorId: input.actorId,
        targetId: input.targetId,
        organizationIds: input.organizationIds,
        requestId: input.requestId,
        reason: input.reason,
        supportContext: input.supportContext,
        timelineFilter: subjectAccessState.timelineFilter,
        timeline: input.timeline,
        supportActivityRollup: input.supportActivityRollup,
        accessStatus: subjectAccessState.accessStatus,
        accessRecoveryPlan: subjectAccessState.accessRecoveryPlan,
    })
    return { subjectAccessState, authorization, receipts }
}
