import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requireAdminSupport } from '../auth.ts'
import { supportInspectionAuditMetadata } from '#utils/support/adminSupportInput.ts'
import { toSupportUser, toSupportMembership, toSupportInvite } from './subjectMapping.ts'
import { loadSupportUserInspectionData } from './subjectInspectionData.ts'
import { sendOrganizationEntityInspectionNotFound } from './organizationInspectionNotFound.ts'
import { supportRecentAuditTimeline } from './recentAuditTimeline.ts'
import { toAccessRecoveryDecision } from './accessRecoveryApprovalMapping.ts'
import { supportUserActivityRollup } from './activityRollups.ts'
import { buildSupportSubjectInspectionContext } from './subjectInspectionContext.ts'
import { supportUserCaseAccessReadiness, supportUserCaseEvidence } from './userAccessReadiness.ts'
import { supportUserCaseHandoff } from './userHandoff.ts'
import { supportCaseTimelineEvidence } from '../audit/auditCaseTimeline.ts'
import { supportSubjectInspectionResponseFields } from './subjectInspectionPresentation.ts'
import { organizationMembershipAvailability as loadOrganizationAvailability } from '#utils/organizationMemberships.ts'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'
import { recordSupportSubjectInspection } from './subjectInspectionAudit.ts'

type UserParams = { id: string }

export async function getSupportUser(req: FastifyRequest<{ Params: UserParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const inspectionAudit = supportInspectionAuditMetadata(req)
    const user = await run(`
        SELECT id, name, avatar, email, active, reserved, deactivated_at, deactivated_by, deletion_requested_at, deletion_scheduled_at
        FROM users
        WHERE id = $1
        LIMIT 1
    `, [req.params.id])
    const userRow = user.rows[0] as Record<string, unknown> | undefined
    if (!userRow) {
        return sendOrganizationEntityInspectionNotFound({
            req, res, actorId: actor.id, metadata: inspectionAudit, kind: 'user',
            targetId: req.params.id, error: 'user_not_found', responseError: 'User not found.',
        })
    }

    const { memberships, invites, audit, approvals } = await loadSupportUserInspectionData({
        userId: req.params.id,
        email: String(userRow.email || ''),
        requestId: inspectionAudit.requestId,
    })

    await recordSupportSubjectInspection({
        req,
        actorId: actor.id,
        kind: 'user',
        targetId: req.params.id,
        metadata: inspectionAudit,
        context: {
            active: userRow.active,
            membershipCount: memberships.rows.length,
            pendingInviteCount: invites.rows.length,
            deletionScheduled: Boolean(userRow.deletion_scheduled_at),
        },
    })

    const recentAuditTimeline = supportRecentAuditTimeline({
        target: req.params.id,
        entity: req.params.id,
        request: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        action: 'support.user',
    }, audit.rows as Record<string, unknown>[])
    const approvalDetails = (approvals as AccessRecoveryApprovalRow[]).map(toAccessRecoveryDecision)
    const organizationIds = Array.from(new Set([
        ...memberships.rows.map(row => String((row as Record<string, unknown>).organization_id || '')).filter(Boolean),
        ...invites.rows.map(row => String((row as Record<string, unknown>).organization_id || '')).filter(Boolean),
        ...approvalDetails.map(item => String(item.organizationId || '')).filter(Boolean),
    ]))
    const supportActivityRollup = supportUserActivityRollup({
        userId: req.params.id,
        requestId: inspectionAudit.requestId,
        organizationIds,
        timeline: recentAuditTimeline.events,
    })
    const availability = organizationIds.length ? await loadOrganizationAvailability(organizationIds) : []
    const { subjectAccessState, authorization, receipts: subjectReceipts } = buildSupportSubjectInspectionContext({
        kind: 'user',
        actorId: actor.id,
        requestedId: req.params.id,
        targetId: req.params.id,
        organizationIds,
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        users: [userRow],
        memberships: memberships.rows as Record<string, unknown>[],
        invites: invites.rows as Record<string, unknown>[],
        approvalDetails,
        availability,
        timeline: recentAuditTimeline.events,
        supportActivityRollup,
    })
    const { accessStatus: userAccessStatus, accessRecoveryPlan } = subjectAccessState
    const { actionHistoryExport } = subjectReceipts
    const supportMemberships = memberships.rows.map(toSupportMembership)
    const supportInvites = invites.rows.map(toSupportInvite)
    const timelineEvidence = supportCaseTimelineEvidence(recentAuditTimeline.events)
    const caseEvidence = supportUserCaseEvidence({
        memberships: supportMemberships,
        pendingInvites: supportInvites,
        approvalRequests: approvalDetails,
        auditEventIds: timelineEvidence.auditEventIds,
    })
    const caseAccessReadiness = supportUserCaseAccessReadiness({
        userId: req.params.id,
        organizationIds,
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        accessStatus: userAccessStatus,
        accessRecoveryPlan,
        evidence: caseEvidence,
    })
    const caseHandoff = supportUserCaseHandoff({
        actorId: actor.id,
        userId: req.params.id,
        organizationIds,
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        evidence: caseEvidence,
        timelineEvidence,
        caseAccessReadiness,
        accessRecoveryPlan,
        actionHistoryExport,
    })
    return res.send({
        user: toSupportUser(userRow),
        memberships: supportMemberships,
        pendingInvites: supportInvites,
        approvalRequests: approvalDetails,
        ...supportSubjectInspectionResponseFields({
            kind: 'user',
            targetId: req.params.id,
            authorization,
            subjectAccessState,
            receipts: subjectReceipts,
            caseAccessReadiness,
            caseHandoff,
            supportActivityRollup,
            recentAuditTimeline,
            relatedRecordCount: memberships.rows.length,
            pendingInviteCount: invites.rows.length,
        }),
    })
}
