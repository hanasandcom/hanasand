import { organizationMembershipAvailability as loadOrganizationAvailability } from '#utils/organizationMemberships.ts'
import { loadInspectionApprovals, loadInspectionAuditEvents } from '../../inspectionEventLoaders.ts'
import {
    loadInspectionInvites,
    loadInspectionMemberships,
    loadInspectionOrganizations,
    loadInspectionUsers,
} from '../../inspectionEntityLoaders.ts'
import { toSupportAuditTimelineEvent } from '../../audit/auditEventProjection.ts'
import { toAccessRecoveryDecision } from '../accessRecoveryApprovalMapping.ts'
import { buildSupportInspectionAuthorization } from './authorization.ts'
import { supportTimelineFilter } from './timelineFilter.ts'
import type { SupportInspectionRequest } from './inspectionRequest.ts'
import type { AccessRecoveryApprovalRow } from '../../supportTypes.ts'

export async function loadSupportInspectionData(input: SupportInspectionRequest) {
    const { q, email, outcome, limit } = input.filters
    const {
        entityType, supportSession, workflow, action,
        severity, source, service, blocker, reason, scope, context, from, to,
    } = input.filters
    const { org, user, request, entity } = input
    const [organizations, users, memberships, invites, approvals, audit] = await Promise.all([
        loadInspectionOrganizations({ q, org, user, email, request, limit }),
        loadInspectionUsers({ q, user, request, limit }),
        loadInspectionMemberships({ q, org, user, request, limit }),
        loadInspectionInvites({ q, org, email, request, limit }),
        loadInspectionApprovals({ q, org, user, email, request, outcome, limit }),
        loadInspectionAuditEvents({
            q, org, user, email, request, entity, entityType, supportSession, workflow,
            action, severity, outcome, source, service, blocker, reason, scope, context,
            from, to, limit,
        }),
    ])
    const timelineFilter = supportTimelineFilter({ ...input.filters, org, user, request, entity })
    const auditTimelineFilters = {
        q,
        org,
        target: user || email,
        request,
        entity,
        entityType,
        supportSession,
        workflow,
        action,
        severity,
        outcome,
        source,
        service,
        blocker,
        reason,
        scope,
        context,
        from,
        to,
        limit,
    }
    const notFound = !organizations.length && !users.length && !memberships.length && !invites.length && !approvals.length && !audit.length
    const organizationIds = Array.from(new Set([
        ...organizations.map(row => String(row.id)),
        ...memberships.map(row => String(row.organization_id)),
        ...invites.map(row => String(row.organization_id)),
        ...approvals.map(row => String(row.organization_id)),
        ...audit.map(row => String((row as Record<string, unknown>).organization_id || '')).filter(Boolean),
    ]))
    const authorization = buildSupportInspectionAuthorization({
        actorId: input.actorId,
        requestedOrg: input.requestedOrg,
        requestedUser: input.requestedUser,
        effectiveOrg: input.org,
        effectiveUser: input.user,
        email,
        request: input.request,
        entity: input.entity,
        supportSession,
        sessionState: input.sessionState,
        organizationIds,
    })
    const availability = organizationIds.length ? await loadOrganizationAvailability(organizationIds) : []
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const timeline = audit.map(toSupportAuditTimelineEvent)
    const approvalDetails = approvals.map(row => toAccessRecoveryDecision(row as AccessRecoveryApprovalRow))

    return {
        organizations,
        users,
        memberships,
        invites,
        approvals,
        audit,
        timelineFilter,
        auditTimelineFilters,
        notFound,
        organizationIds,
        authorization,
        availabilityByOrg,
        timeline,
        approvalDetails,
    }
}
