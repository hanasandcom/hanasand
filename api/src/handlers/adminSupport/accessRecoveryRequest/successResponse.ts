import type { FastifyReply } from 'fastify'
import { upsertAdminAccessRecoveryApproval } from '#utils/db/identityDataWrites.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'
import { toInvite, toOrganization } from '#utils/organizations.ts'
import { supportAccessRecoveryExecutionReceipt } from '../cases/accessRecoveryExecutionReceipt.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'
import type { SupportAccessRecoveryRequestContext } from './types.ts'

export async function sendAccessRecoverySuccess(context: SupportAccessRecoveryRequestContext, res: FastifyReply) {
    const { req, actor, organization, requestId, reason, supportSessionId, supportContext, targetUserId, existingMembership, inviteRow, approval } = context
    await upsertAdminAccessRecoveryApproval({
        requestId,
        organizationId: organization.id,
        inviteId: inviteRow.id,
        targetUserId: targetUserId || null,
        requestedBy: actor.id,
        requestedReason: reason,
        requestContext: supportContext,
        approvalRequired: approval.approvalRequired,
        status: approval.approvalRequired ? 'pending' : 'not_required',
        expiresAt: inviteRow.expires_at,
    })
    await recordSystemEvent(req, {
        actionType: 'support.organization.access_recovery',
        actorId: actor.id,
        targetType: targetUserId ? 'user' : 'invite',
        targetId: targetUserId || inviteRow.email,
        organizationId: organization.id,
        entityId: inviteRow.id,
        requestId,
        severity: 'warning',
        outcome: 'success',
        reason,
        context: {
            email: inviteRow.email,
            role: inviteRow.role,
            expiresAt: inviteRow.expires_at,
            inviteId: inviteRow.id,
            inviteStatus: inviteRow.status,
            targetUserId: targetUserId || null,
            supportSessionId: supportSessionId || null,
            existingMembership: existingMembership || null,
            caseId: text(req.body?.caseId) || null,
            supportContext,
            mutation: 'controlled_invite_only',
            approval,
        },
    })
    const auditEventIds = await loadSystemEventIds({
        requestId,
        actionType: 'support.organization.access_recovery',
        entityId: inviteRow.id,
    })
    return res.status(201).send({
        recovery: {
            schemaVersion: 'support.access_recovery.v1',
            organization: toOrganization(organization),
            targetUserId: targetUserId || null,
            invite: toInvite(inviteRow),
            existingMembership: existingMembership || null,
            reason,
            requestId,
            requestedBy: actor.id,
            approvalRequired: approval.approvalRequired,
            approvalStatus: approval.status,
            approvedBy: approval.approvedBy,
            approvedAt: approval.approvedAt,
            supportSessionId: supportSessionId || null,
            approval,
            executionReceipt: supportAccessRecoveryExecutionReceipt({
                actorId: actor.id,
                organizationId: organization.id,
                requestId,
                reason,
                supportSessionId,
                targetUserId,
                email: inviteRow.email,
                role: inviteRow.role,
                expiresAt: inviteRow.expires_at,
                inviteId: inviteRow.id,
                inviteStatus: inviteRow.status,
                approval,
                outcome: 'success',
                auditEventIds,
                blockers: approval.approvalRequired ? ['pending_approval_requires_decision'] : [],
            }),
            auditEventIds,
            audit: {
                actionType: 'support.organization.access_recovery',
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: 'warning',
                eventIds: auditEventIds,
                query: `/api/admin/audit-events?request=${encodeURIComponent(requestId)}&outcome=success&source=system&service=hanasand-api`,
            },
            copyText: [
                `Access recovery invite created for ${inviteRow.email}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${inviteRow.role}`,
                `Expires: ${inviteRow.expires_at}`,
                `Request: ${requestId}`,
                `Approval: ${approval.status}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                approval.approvalRequired ? 'Share status: waiting for approval' : 'Share status: ready',
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}
