import type { FastifyRequest } from 'fastify'
import type { OrganizationInviteRow, OrganizationRow } from '#utils/organizations.ts'
import { organizationMembershipAvailability as loadOrganizationAvailability } from '#utils/organizationMemberships.ts'
import { loadInspectionApprovals } from '../inspectionEventLoaders.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { supportInspectionAuditContext, supportInspectionAuditMetadata } from '#utils/support/adminSupportInput.ts'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'
import { buildRecoveryEligibility } from './subjectMapping.ts'
import { buildSupportAccessRecoveryPlan } from './accessRecoveryPlan.ts'
import { supportRecentAuditTimeline } from './recentAuditTimeline.ts'
import { buildSupportInspectionAuthorization } from './inspection/authorization.ts'
import { supportTimelineFilter } from './inspection/timelineFilter.ts'
import { loadSupportOrganizationEntityAuditRows } from './organizationReadData.ts'
import { toAccessRecoveryDecision } from './accessRecoveryApprovalMapping.ts'

export async function prepareSupportOrganizationEntityInspection(input: {
    req: FastifyRequest
    actorId: string
    organization: OrganizationRow
    metadata: ReturnType<typeof supportInspectionAuditMetadata>
    requestedOrg: string
    target: { kind: 'invite', record: OrganizationInviteRow } | { kind: 'member', record: Record<string, unknown> }
}) {
    const isInvite = input.target.kind === 'invite'
    const record = input.target.record as Record<string, unknown>
    const targetId = String(isInvite ? record.id : record.user_id)
    const userId = isInvite ? '' : targetId
    const email = isInvite ? String(record.email) : ''
    const actionType = `support.organization.${input.target.kind}`
    const eventContext = isInvite
        ? { inviteId: targetId, email, status: record.status, role: record.role }
        : { userId, role: record.role, status: record.status, active: record.active }
    const auditRows = await loadSupportOrganizationEntityAuditRows({
        organizationId: input.organization.id,
        targetId,
        kind: input.target.kind,
    })
    await recordSystemEvent(input.req, {
        actionType: `${actionType}.inspect`,
        actorId: input.actorId,
        targetType: input.target.kind,
        targetId: isInvite ? email : userId,
        organizationId: input.organization.id,
        entityId: targetId,
        requestId: input.metadata.requestId,
        severity: 'info',
        outcome: 'success',
        reason: input.metadata.reason || undefined,
        context: supportInspectionAuditContext(input.metadata, eventContext),
    })

    const recentAuditTimeline = supportRecentAuditTimeline({
        org: input.organization.id,
        target: userId || email,
        entity: targetId,
        entityType: input.target.kind,
        request: input.metadata.requestId,
        reason: input.metadata.reason,
        action: actionType,
    }, auditRows as Record<string, unknown>[])
    const [availability, approvals] = await Promise.all([
        loadOrganizationAvailability([input.organization.id]),
        loadInspectionApprovals({
            org: input.organization.id,
            user: userId,
            email,
            request: input.metadata.requestId,
            outcome: '',
            limit: 25,
        }),
    ])
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const approvalDetails = (approvals as AccessRecoveryApprovalRow[]).map(toAccessRecoveryDecision)
    const timelineFilter = supportTimelineFilter({
        q: '', org: input.organization.id, user: userId, email, request: input.metadata.requestId,
        entity: targetId, entityType: input.target.kind, supportSession: '', action: actionType,
        severity: '', outcome: '', source: 'admin', service: 'hanasand-api', blocker: '',
        reason: input.metadata.reason, context: input.metadata.supportContext, from: '', to: '', limit: 25,
    })
    const recoveryEligibility = buildRecoveryEligibility({
        email,
        user: userId,
        organizationIds: [input.organization.id],
        memberships: isInvite ? [] : [record],
        users: isInvite ? [] : [record],
        availabilityByOrg,
        invites: isInvite ? [record] : [],
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: input.organization.id,
        user: userId,
        email,
        request: input.metadata.requestId,
        organizationIds: [input.organization.id],
        memberships: isInvite ? [] : [record],
        invites: isInvite ? [record] : [],
        approvalDetails,
        recoveryEligibility,
        availabilityByOrg,
        timeline: recentAuditTimeline.events,
        timelineFilter,
    })
    const authorization = buildSupportInspectionAuthorization({
        actorId: input.actorId,
        requestedOrg: input.requestedOrg,
        requestedUser: userId,
        effectiveOrg: input.organization.id,
        effectiveUser: userId,
        email,
        request: input.metadata.requestId,
        entity: targetId,
        supportSession: '',
        sessionState: null,
        organizationIds: [input.organization.id],
    })
    return { recentAuditTimeline, approvalDetails, accessRecoveryPlan, authorization }
}
