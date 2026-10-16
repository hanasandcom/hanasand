import type { FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'
import run from '#db'
import { touchOrganization, updateOrganizationInviteAction, upsertOrganizationInvite } from '#utils/db/identityDataWrites.ts'
import type { OrganizationInviteRow } from '#utils/organizations.ts'
import { supportError, supportText as text } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'
import { supportAccessRecoveryExecutionReceipt } from '../cases/accessRecoveryExecutionReceipt.ts'
import { accessRecoveryApprovalMetadata } from '../cases/accessRecoveryApprovalMetadata.ts'
import type { PreparedSupportAccessRecoveryRequest, SupportAccessRecoveryRequestContext } from './types.ts'

export async function createAccessRecoveryInvite(
    context: PreparedSupportAccessRecoveryRequest,
    res: FastifyReply,
): Promise<SupportAccessRecoveryRequestContext | undefined> {
    const existingMembershipResult = context.targetUserId
        ? await run(`
            SELECT organization_id, user_id, role, status
            FROM organization_members
            WHERE organization_id = $1
              AND user_id = $2
            LIMIT 1
        `, [context.organization.id, context.targetUserId])
        : { rows: [] }

    let inviteRow = await upsertOrganizationInvite({
        id: randomUUID(),
        organizationId: context.organization.id,
        email: context.input.emails[0],
        role: context.input.role,
        invitedBy: context.actor.id,
        expiresAt: context.input.expiresAt,
    }) as OrganizationInviteRow
    await touchOrganization(context.organization.id)
    const approval = accessRecoveryApprovalMetadata({
        actorId: context.actor.id,
        role: inviteRow.role,
        expiresAt: inviteRow.expires_at,
        requestId: context.requestId,
        outcome: 'success',
        context: context.supportContext,
        existingMembership: existingMembershipResult.rows[0],
        requestedApprovalRequired: context.req.body?.approvalRequired,
    })

    if (approval.approvalRequired) {
        const revokedInvite = await updateOrganizationInviteAction({
            organizationId: context.organization.id,
            inviteId: inviteRow.id,
            action: 'revoke',
        })
        if (!revokedInvite) {
            const currentInvite = await run(`
                SELECT status
                FROM organization_invites
                WHERE id = $1 AND organization_id = $2
                LIMIT 1
            `, [inviteRow.id, context.organization.id])
            const inviteStatus = text(currentInvite.rows[0]?.status)
            const blocker = inviteStatus === 'accepted'
                ? 'accepted_invite_not_mutable_by_support_action'
                : 'support_invite_revoke_failed'
            const message = inviteStatus === 'accepted'
                ? 'The invite was accepted before support could hold it for approval.'
                : 'The invite changed before support could hold it for approval.'
            await recordSystemEvent(context.req, {
                actionType: 'support.organization.access_recovery',
                actorId: context.actor.id,
                targetType: context.targetUserId ? 'user' : 'invite',
                targetId: context.targetUserId || inviteRow.email,
                organizationId: context.organization.id,
                entityId: inviteRow.id,
                requestId: context.requestId,
                severity: 'warning',
                outcome: 'failed',
                reason: context.reason,
                context: {
                    schemaVersion: 'support.access_recovery.invite_transition.v1',
                    requestId: context.requestId,
                    supportSessionId: context.supportSessionId || null,
                    targetUserId: context.targetUserId || null,
                    inviteId: inviteRow.id,
                    inviteStatus: inviteStatus || null,
                    blockerCode: blocker,
                    approvalRequired: true,
                    mutation: 'none',
                    noSilentMembershipMutation: true,
                    supportContext: context.supportContext,
                    redactionRequired: true,
                },
            })
            const auditEventIds = await loadSystemEventIds({
                requestId: context.requestId,
                actionType: 'support.organization.access_recovery',
                entityId: inviteRow.id,
            })
            res.status(409).send(supportError(blocker, message, {
                schemaVersion: 'support.access_recovery.invite_transition.v1',
                outcome: 'failed',
                requestId: context.requestId,
                inviteId: inviteRow.id,
                inviteStatus: inviteStatus || null,
                auditEventIds,
                noSilentMembershipMutation: true,
                executionReceipt: supportAccessRecoveryExecutionReceipt({
                    actorId: context.actor.id,
                    organizationId: context.organization.id,
                    requestId: context.requestId,
                    reason: context.reason,
                    supportSessionId: context.supportSessionId,
                    targetUserId: context.targetUserId,
                    email: inviteRow.email,
                    role: inviteRow.role,
                    expiresAt: inviteRow.expires_at,
                    inviteId: inviteRow.id,
                    inviteStatus: inviteStatus || null,
                    approval: null,
                    outcome: 'failed',
                    auditEventIds,
                    blockers: [blocker],
                }),
            }))
            return
        }
        inviteRow = revokedInvite as OrganizationInviteRow
    }

    return {
        ...context,
        existingMembership: existingMembershipResult.rows[0] || null,
        inviteRow,
        approval,
    }
}
