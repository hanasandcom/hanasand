import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requireAdminSupport } from '../auth.ts'
import { supportInspectionAuditMetadata } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { toOrganization, type OrganizationInviteRow } from '#utils/organizations.ts'
import { inviteSnapshot, toSupportInvite, toSupportMemberDetail, membershipSnapshot } from './subjectMapping.ts'
import { supportInviteCaseHandoff, supportMemberCaseHandoff } from './inviteAndMemberHandoff.ts'
import { prepareSupportOrganizationEntityInspection } from './organizationEntityInspection.ts'
import { loadOrganizationSupportDetail, loadSupportMemberDetail } from './organizationReadData.ts'
import { sendOrganizationEntityInspectionNotFound } from './organizationInspectionNotFound.ts'

type OrganizationParams = { id: string }
type SupportInviteActionParams = OrganizationParams & { inviteId: string }
type OrganizationMemberParams = OrganizationParams & { userId: string }

export async function getSupportOrganizationInvite(req: FastifyRequest<{ Params: SupportInviteActionParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return
    const inspectionAudit = supportInspectionAuditMetadata(req)
    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        return sendOrganizationEntityInspectionNotFound({
            req, res, actorId: actor.id, metadata: inspectionAudit, kind: 'invite',
            targetId: req.params.inviteId, organizationId: req.params.id,
            error: 'organization_not_found', contextKey: 'inviteId', responseError: 'Organization not found.',
        })
    }

    const inviteResult = await run(`
        SELECT invite.*, organization.name AS organization_name, organization.slug AS organization_slug
        FROM organization_invites invite
        JOIN organizations organization ON organization.id = invite.organization_id
        WHERE invite.id = $1
          AND invite.organization_id = $2
        LIMIT 1
    `, [req.params.inviteId, organization.id])
    const invite = inviteResult.rows[0] as OrganizationInviteRow | undefined
    if (!invite) {
        return sendOrganizationEntityInspectionNotFound({
            req, res, actorId: actor.id, metadata: inspectionAudit, kind: 'invite',
            targetId: req.params.inviteId, organizationId: organization.id,
            error: 'invite_not_found', contextKey: 'inviteId', responseError: 'Invite not found for organization.',
        })
    }

    const inspection = await prepareSupportOrganizationEntityInspection({
        req, actorId: actor.id, organization, metadata: inspectionAudit,
        requestedOrg: req.params.id,
        target: { kind: 'invite', record: invite },
    })
    const { recentAuditTimeline, approvalDetails, accessRecoveryPlan, authorization } = inspection
    const inviteDto = toSupportInvite(invite)
    const caseHandoff = supportInviteCaseHandoff({
        actorId: actor.id,
        organizationId: organization.id,
        invite: inviteDto,
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        accessRecoveryPlan,
        approvals: approvalDetails,
        timeline: recentAuditTimeline.events,
    })
    return res.send({
        invite: inviteDto,
        inviteInspection: {
            schemaVersion: 'support.invite_inspection.v1',
            organization: toOrganization(organization),
            invite: inviteDto,
            snapshot: inviteSnapshot(invite),
            authorization,
            accessRecoveryPlan,
            caseHandoff,
            auditEventIds: recentAuditTimeline.eventIds,
            auditTimeline: recentAuditTimeline,
            links: {
                action: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/invites/${encodeURIComponent(invite.id)}/actions`,
                accessRecovery: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/access-recovery`,
                audit: auditFilterQuery({ org: organization.id, entity: invite.id, entityType: 'invite' }),
            },
            noMutation: true,
            redacted: true,
            copyText: [
                `Support invite inspection ${invite.id}`,
                `Organization: ${organization.name} (${organization.id})`,
                `Email: ${invite.email}`,
                `Status: ${invite.status}`,
                `Audit events: ${recentAuditTimeline.eventIds.join(', ') || 'none'}`,
            ].join('\n'),
        },
    })
}

export async function getSupportOrganizationMember(req: FastifyRequest<{ Params: OrganizationMemberParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return
    const inspectionAudit = supportInspectionAuditMetadata(req)
    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        return sendOrganizationEntityInspectionNotFound({
            req, res, actorId: actor.id, metadata: inspectionAudit, kind: 'member',
            targetId: req.params.userId, organizationId: req.params.id,
            error: 'organization_not_found', contextKey: 'userId', responseError: 'Organization not found.',
        })
    }

    const member = await loadSupportMemberDetail(organization.id, req.params.userId)
    if (!member) {
        return sendOrganizationEntityInspectionNotFound({
            req, res, actorId: actor.id, metadata: inspectionAudit, kind: 'member',
            targetId: req.params.userId, organizationId: organization.id,
            error: 'member_not_found', contextKey: 'userId', responseError: 'Organization member not found.',
        })
    }

    const inspection = await prepareSupportOrganizationEntityInspection({
        req, actorId: actor.id, organization, metadata: inspectionAudit,
        requestedOrg: req.params.id,
        target: { kind: 'member', record: member },
    })
    const { recentAuditTimeline, approvalDetails, accessRecoveryPlan, authorization } = inspection
    const memberDto = toSupportMemberDetail(member)
    const caseHandoff = supportMemberCaseHandoff({
        actorId: actor.id,
        organizationId: organization.id,
        member: memberDto,
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        accessRecoveryPlan,
        approvals: approvalDetails,
        timeline: recentAuditTimeline.events,
    })
    return res.send({
        member: memberDto,
        memberInspection: {
            schemaVersion: 'support.member_inspection.v1',
            organization: toOrganization(organization),
            member: memberDto,
            snapshot: membershipSnapshot(member),
            authorization,
            accessRecoveryPlan,
            caseHandoff,
            auditEventIds: recentAuditTimeline.eventIds,
            auditTimeline: recentAuditTimeline,
            links: {
                roleRecovery: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/members/${encodeURIComponent(req.params.userId)}/role-recovery`,
                audit: auditFilterQuery({ org: organization.id, target: req.params.userId, entity: req.params.userId, entityType: 'member' }),
                user: `/api/admin/support/users/${encodeURIComponent(req.params.userId)}`,
            },
            noMutation: true,
            redacted: true,
            copyText: [
                `Support member inspection ${req.params.userId}`,
                `Organization: ${organization.name} (${organization.id})`,
                `Role: ${member.role}`,
                `Status: ${member.status}`,
                `Audit events: ${recentAuditTimeline.eventIds.join(', ') || 'none'}`,
            ].join('\n'),
        },
    })
}
