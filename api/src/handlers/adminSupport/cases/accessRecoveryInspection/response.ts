import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { loadSupportMemberDetail } from '../organizationReadData.ts'
import { organizationMembershipAvailability as loadOrganizationAvailability } from '#utils/organizationMemberships.ts'
import { toAccessRecoveryDecision } from '../accessRecoveryApprovalMapping.ts'
import { supportAccessRecoveryApprovalTimeline, accessRecoveryApprovalAuditFilters } from '../accessRecoveryApprovalTimeline.ts'
import { toSupportAuditTimelineEvent } from '../../audit/auditEventProjection.ts'
import { auditTimelineSummary } from '../../audit/auditEntityTimeline.ts'
import { supportAuditFilterContract } from '../../audit/auditFilterPackets.ts'
import { supportAuditExportProof } from '../../audit/auditExportPackets.ts'
import { supportAuditWorkflowRollup } from '../../audit/auditWorkflowSummary.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { supportTimelineFilter } from '../inspection/timelineFilter.ts'
import { buildSupportInspectionAuthorization } from '../inspection/authorization.ts'
import { buildRecoveryEligibility } from '../subjectMapping.ts'
import { buildSupportAccessRecoveryPlan } from '../accessRecoveryPlan.ts'
import type { AccessRecoveryApprovalRow } from '../../supportTypes.ts'

export async function sendSupportAccessRecoveryInspection(input: {
    req: FastifyRequest
    res: FastifyReply
    actorId: string
    approval: AccessRecoveryApprovalRow
    inspectionRequestId: string
}) {
    const { req, res, actorId, approval, inspectionRequestId } = input
    const detail = toAccessRecoveryDecision(approval)
    const auditRows = await run(`
        SELECT
            event.id,
            event.event_type,
            event.severity,
            event.source,
            event.service,
            event.actor_id,
            actor.name AS actor_name,
            event.object_type,
            event.object_id,
            target_user.name AS target_name,
            event.organization_id,
            organization.name AS organization_name,
            event.subject_id,
            event.request_id,
            event.outcome,
            event.reason,
            event.context,
            event.created_at
        FROM system_events event
        LEFT JOIN users actor ON actor.id = event.actor_id
        LEFT JOIN users target_user ON target_user.id = event.object_id
        LEFT JOIN organizations organization ON organization.id = event.organization_id
        WHERE event.request_id = $1
           OR event.subject_id = $2
        ORDER BY event.created_at DESC
        LIMIT 50
    `, [approval.request_id, approval.invite_id])
    await recordSystemEvent(req, {
        actionType: 'support.organization.access_recovery.inspect',
        actorId: actorId,
        targetType: 'access_recovery',
        targetId: approval.request_id,
        organizationId: approval.organization_id,
        entityId: approval.invite_id,
        requestId: inspectionRequestId,
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.access_recovery.inspect.v1',
            requestId: approval.request_id,
            organizationId: approval.organization_id,
            inviteId: approval.invite_id,
            status: approval.status,
            outcome: approval.outcome,
            redactionRequired: true,
        },
    })
    const auditFilters = accessRecoveryApprovalAuditFilters({
        request: approval.request_id,
        org: approval.organization_id,
        status: approval.status,
        outcome: approval.outcome,
    })
    const timeline = (auditRows.rows as Record<string, unknown>[]).map(toSupportAuditTimelineEvent)
    const approvalTimeline = supportAccessRecoveryApprovalTimeline(auditFilters, [detail])
    const [availability, memberDetail] = await Promise.all([
        loadOrganizationAvailability([approval.organization_id]),
        detail.targetUserId ? loadSupportMemberDetail(approval.organization_id, detail.targetUserId) : Promise.resolve(undefined),
    ])
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const approvalInvite = {
        id: approval.invite_id,
        organization_id: approval.organization_id,
        organization_name: approval.organization_name,
        email: approval.email,
        role: approval.role,
        status: approval.invite_status,
        expires_at: approval.expires_at,
        accepted_at: null,
    } as Record<string, unknown>
    const recoveryEligibility = buildRecoveryEligibility({
        email: approval.email || '',
        user: detail.targetUserId || '',
        organizationIds: [approval.organization_id],
        memberships: memberDetail ? [memberDetail] : [],
        users: memberDetail ? [memberDetail] : [],
        availabilityByOrg,
        invites: [approvalInvite],
    })
    const timelineFilter = supportTimelineFilter({
        q: '',
        org: approval.organization_id,
        user: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        entity: approval.invite_id,
        entityType: 'invite',
        supportSession: '',
        action: 'support.organization.access_recovery',
        severity: '',
        outcome: approval.outcome,
        source: 'admin',
        service: 'hanasand-api',
        blocker: '',
        reason: detail.requestedReason || detail.decisionReason || '',
        context: '',
        from: '',
        to: '',
        limit: 50,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: approval.organization_id,
        user: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        organizationIds: [approval.organization_id],
        memberships: memberDetail ? [memberDetail] : [],
        invites: [approvalInvite],
        approvalDetails: [detail],
        recoveryEligibility,
        availabilityByOrg,
        timeline,
        timelineFilter,
    })
    const authorization = buildSupportInspectionAuthorization({
        actorId: actorId,
        requestedOrg: approval.organization_id,
        requestedUser: detail.targetUserId || '',
        effectiveOrg: approval.organization_id,
        effectiveUser: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        entity: approval.invite_id,
        supportSession: '',
        sessionState: null,
        organizationIds: [approval.organization_id],
    })
    return res.send({
        accessRecovery: detail,
        accessRecoveryInspection: {
            schemaVersion: 'support.access_recovery.inspection.v1',
            approval: detail,
            authorization,
            accessRecoveryPlan,
            auditEventIds: timeline.map(event => event.id),
            auditTimeline: {
                schemaVersion: 'support.access_recovery.inspection_timeline.v1',
                filters: auditFilters,
                eventIds: timeline.map(event => event.id),
                summary: auditTimelineSummary(timeline),
                filterContract: supportAuditFilterContract(auditFilters, timeline),
                exportProof: supportAuditExportProof(auditFilters, timeline),
                workflowRollup: supportAuditWorkflowRollup(auditFilters, timeline),
                timeline,
                redacted: true,
            },
            approvalTimeline,
            links: {
                approve: `/api/admin/support/access-recovery/${encodeURIComponent(approval.request_id)}/approve`,
                deny: `/api/admin/support/access-recovery/${encodeURIComponent(approval.request_id)}/deny`,
                organization: `/api/admin/support/organizations/${encodeURIComponent(approval.organization_id)}`,
                invite: `/api/admin/support/organizations/${encodeURIComponent(approval.organization_id)}/invites/${encodeURIComponent(approval.invite_id)}`,
                audit: auditFilterQuery(auditFilters),
            },
            noMutation: true,
            redacted: true,
            copyText: [
                `Access recovery request ${approval.request_id}`,
                `Status: ${approval.status}`,
                `Outcome: ${approval.outcome}`,
                `Invite: ${approval.invite_id} (${approval.invite_status || 'unknown'})`,
                `Audit events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
            ].join('\n'),
        },
    })
}
