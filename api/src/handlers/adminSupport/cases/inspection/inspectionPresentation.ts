import type { FastifyReply, FastifyRequest } from 'fastify'
import { supportRequestId } from '#utils/support/adminSupportInput.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { supportSessionResponse } from '#utils/support/sessionPresentation.ts'
import { toSupportUser, toSupportMemberDetail, toSupportInvite } from '../subjectMapping.ts'
import { auditTimelineSummary } from '../../audit/auditEntityTimeline.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditFilterContract } from '../../audit/auditFilterPackets.ts'
import { supportAuditExportProof } from '../../audit/auditExportPackets.ts'
import { supportAuditSupportWorkflowPacket, supportAuditWorkflowRollup } from '../../audit/auditWorkflowSummary.ts'
import { auditTimelineLink } from '../../audit/auditLinks.ts'
import type { OrganizationRow } from '#utils/organizations.ts'
import { toOrganization } from '#utils/organizations.ts'
import type { SupportInspectionRequest } from './inspectionRequest.ts'
import { loadSupportInspectionData } from './inspectionData.ts'
import { buildSupportInspectionCaseModels } from './inspectionCaseModels.ts'
import { buildSupportInspectionProofs } from './inspectionProofs.ts'

type LoadedInspection = Awaited<ReturnType<typeof loadSupportInspectionData>>
type InspectionModels = ReturnType<typeof buildSupportInspectionCaseModels>
type InspectionProofs = ReturnType<typeof buildSupportInspectionProofs>

export async function sendSupportInspectionResponse(input: {
    req: FastifyRequest
    res: FastifyReply
    request: SupportInspectionRequest
    data: LoadedInspection
    models: InspectionModels
    workbench: Record<string, any>
    workbenchAdapter: Record<string, any>
    proofs: InspectionProofs
}) {
    const { req, res, request, data, models, workbench, workbenchAdapter, proofs } = input
    const {
        actorId, org, user, email, request: requestId, entity, supportSession,
        sessionState,
    } = request
    const {
        q, entityType, action, severity, outcome, source, service, blocker,
        reason, context: contextFilter, from, to, limit,
    } = request.filters
    const {
        organizations, users, memberships, invites, approvals, organizationIds,
        authorization, availabilityByOrg, timeline, timelineFilter, auditTimelineFilters,
        approvalDetails,
    } = data
    const {
        recoveryEligibility, accessStatus, accessRecoveryPlan, caseSummary,
    } = models
    const { searchProof, inspectionTimelineProofs, authorizationMatrix, auditDetailPacket, orgBoundaryProof, recoveryFixturePacket } = proofs

    await recordSystemEvent(req, {
        actionType: 'support.inspect',
        actorId,
        targetType: user ? 'user' : email ? 'invite' : org ? 'organization' : supportSession ? 'support_session' : 'request',
        targetId: user || email || org || supportSession || requestId,
        organizationId: organizationIds[0] || null,
        entityId: supportSession || requestId || user || email || org || null,
        requestId: supportRequestId(req),
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.inspection.v1',
            filters: { q, org, user, email, request: requestId, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit },
            organizationCount: organizations.length,
            membershipCount: memberships.length,
            pendingInviteCount: invites.filter(row => row.status === 'pending').length,
            approvalCount: approvals.length,
            auditEventIds: timeline.map(event => event.id),
            authorization,
        },
    })

    const inspectionSearchProof = { searchProof }
    return res.send({
        inspection: {
            schemaVersion: 'support.inspection.v1',
            generatedAt: new Date().toISOString(),
            filters: { q, org, user, email, request: requestId, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit },
            supportSession: sessionState ? supportSessionResponse({
                ...sessionState,
                actorId: sessionState.actorId,
                reason: sessionState.reason,
                requestId: sessionState.requestId,
                auditEventIds: sessionState.auditEventIds,
            }) : null,
            authorization,
            organizations: organizations.map(row => ({
                ...toOrganization(row as OrganizationRow),
                adminAvailability: availabilityByOrg.get(String(row.id)) || null,
            })),
            users: users.map(toSupportUser),
            memberships: memberships.map(toSupportMemberDetail),
            invites: invites.map(toSupportInvite),
            pendingInvites: invites.filter(row => row.status === 'pending').map(toSupportInvite),
            approvalRequests: approvalDetails,
            accessStatus,
            accessRecoveryPlan,
            caseSummary,
            workbench,
            workbenchAdapter,
            ...inspectionSearchProof,
            authorizationMatrix,
            auditDetailPacket,
            orgBoundaryProof,
            recoveryFixturePacket,
            ...inspectionTimelineProofs,
            actionPreparation: workbench.actionPreparation,
            recoveryEligibility,
            auditEventIds: timeline.map(event => event.id),
            auditTimeline: timeline,
            filteredTimeline: {
                schemaVersion: 'support.audit.filtered_timeline.v1',
                filter: timelineFilter,
                eventIds: timeline.map(event => event.id),
                summary: auditTimelineSummary(timeline),
                filterContract: supportAuditFilterContract(auditTimelineFilters, timeline),
                exportProof: supportAuditExportProof(auditTimelineFilters, timeline),
                workflowRollup: supportAuditWorkflowRollup(auditTimelineFilters, timeline),
                supportWorkflowPacket: supportAuditSupportWorkflowPacket(auditTimelineFilters, timeline),
                ...inspectionSearchProof,
                ...inspectionTimelineProofs,
                events: timeline,
                links: {
                    timeline: auditFilterQuery(auditTimelineFilters),
                    details: timeline.map(event => event.links?.detail).filter(Boolean),
                    inviteAssistance: auditTimelineLink({ org, target: email, request: requestId, action: 'invite_assist', outcome }),
                    accessRecovery: auditTimelineLink({ org, target: user || email, request: requestId, action: 'access_recovery', outcome }),
                    impersonation: auditTimelineLink({ target: user, request: requestId, action: 'impersonation', outcome }),
                    supportSession: supportSession ? auditTimelineLink({ request: requestId, action: 'support.session', outcome }) : null,
                },
                redacted: true,
                copyText: [
                    `Support timeline: ${auditFilterQuery(auditTimelineFilters)}`,
                    `Events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
                    `Outcomes: ${uniqueTimelineValues(timeline.map(event => event.outcome)).join(', ') || 'none'}`,
                ].join('\n'),
            },
            controlledActions: {
                inviteAssist: organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
                inviteActions: invites.map(invite => `/api/admin/support/organizations/${encodeURIComponent(String(invite.organization_id))}/invites/${encodeURIComponent(String(invite.id))}/actions`),
                memberRoleRecovery: memberships.map(member => `/api/admin/support/organizations/${encodeURIComponent(String(member.organization_id))}/members/${encodeURIComponent(String(member.user_id))}/role-recovery`),
                accessRecovery: organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
                approvalSearch: `/api/admin/support/access-recovery${requestId ? `?request=${encodeURIComponent(requestId)}` : ''}`,
                supportSession: supportSession ? `/api/admin/support/sessions/${encodeURIComponent(supportSession)}` : null,
                impersonationGuard: {
                    reasonRequired: true,
                    durationRequired: true,
                    scopeRequired: true,
                    noSilentImpersonation: true,
                    auditTimeline: `/api/admin/audit-events?action=impersonation${requestId ? `&request=${encodeURIComponent(requestId)}` : ''}`,
                },
            },
            copyText: [
                `Support inspection q=${q || '*'} org=${org || '*'} user=${user || '*'} email=${email || '*'} request=${requestId || '*'} session=${supportSession || '*'}`,
                `Authorization: ${authorization.supportSessionScoped ? 'scoped support session' : 'support role'}`,
                `Organizations: ${organizations.length}`,
                `Memberships: ${memberships.length}`,
                `Pending invites: ${invites.filter(row => row.status === 'pending').length}`,
                `Access status: ${accessStatus.overall}`,
                `Approvals: ${approvalDetails.length}`,
                `Audit events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
            ].join('\n'),
        },
    })
}
