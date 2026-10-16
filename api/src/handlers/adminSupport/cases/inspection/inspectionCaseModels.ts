import { buildRecoveryEligibility } from '../subjectMapping.ts'
import { buildSupportAccessStatus } from '../accessStatus.ts'
import { buildSupportAccessRecoveryPlan } from '../accessRecoveryPlan.ts'
import { buildSupportCaseSummary } from '../caseSummary.ts'
import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'

type InspectionCaseModelInput = {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    organizations: Array<Record<string, any>>
    users: Array<Record<string, any>>
    memberships: Array<Record<string, any>>
    invites: Array<Record<string, any>>
    availabilityByOrg: Map<string, any>
    approvalDetails: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}

export function buildSupportInspectionCaseModels(input: InspectionCaseModelInput) {
    const recoveryEligibility = buildRecoveryEligibility({
        email: input.email,
        user: input.user,
        organizationIds: input.organizationIds,
        memberships: input.memberships,
        users: input.users,
        availabilityByOrg: input.availabilityByOrg,
        invites: input.invites,
    })
    const accessStatus = buildSupportAccessStatus({
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        organizationIds: input.organizationIds,
        users: input.users,
        memberships: input.memberships,
        invites: input.invites,
        approvalDetails: input.approvalDetails,
        recoveryEligibility,
        availabilityByOrg: input.availabilityByOrg,
        timeline: input.timeline,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        organizationIds: input.organizationIds,
        memberships: input.memberships,
        invites: input.invites,
        approvalDetails: input.approvalDetails,
        recoveryEligibility,
        availabilityByOrg: input.availabilityByOrg,
        timeline: input.timeline,
        timelineFilter: input.timelineFilter,
    })
    const caseSummary = buildSupportCaseSummary({
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        organizationIds: input.organizationIds,
        organizations: input.organizations,
        users: input.users,
        memberships: input.memberships,
        invites: input.invites,
        approvalDetails: input.approvalDetails,
        recoveryEligibility,
        accessStatus,
        timeline: input.timeline,
        timelineFilter: input.timelineFilter,
    })
    return { recoveryEligibility, accessStatus, accessRecoveryPlan, caseSummary }
}
