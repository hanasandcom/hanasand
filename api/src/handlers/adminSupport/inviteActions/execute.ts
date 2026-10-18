import type { FastifyReply } from 'fastify'
import { touchOrganization, updateOrganizationInviteAction } from '#utils/db/identityDataWrites.ts'
import { loadInviteById } from '../../organizations/invites/shared.ts'
import { organizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { normalizeInviteInput, toInvite, toOrganization, type OrganizationInviteRow } from '#utils/organizations.ts'
import { cleanContext } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'
import { inviteSnapshot } from '../cases/subjectMapping.ts'
import { sendAcceptedSupportInviteActionDenial } from './acceptedInviteDenial.ts'
import { sendInviteActionDenial } from './denialResponse.ts'
import { supportInviteActionAuditQuery } from './auditQuery.ts'
import { supportInviteActionExecutionReceipt } from './executionReceipt.ts'
import { supportInviteActionExecutorDetail } from './executorDetail.ts'
import type { SupportInviteActionContext } from './types.ts'

export async function executeSupportInviteAction(context: SupportInviteActionContext, res: FastifyReply) {
    const availability = await organizationMembershipAvailability([context.organization.id])
    if (availability[0]?.hasAvailableAdmin === true) {
        return sendInviteActionDenial({
            ...context,
            res,
            blocker: 'active_admin_available',
            status: 409,
            message: 'An active organization admin is available; support invite action requires unavailable org administration.',
        })
    }

    let expiresAt = context.invite.expires_at
    if (context.action === 'resend' && context.invite.status !== 'accepted') {
        try {
            expiresAt = normalizeInviteInput({
                email: context.invite.email,
                role: context.invite.role,
                expiresAt: context.req.body?.expiresAt ?? context.req.body?.expires_at ?? context.invite.expires_at,
            }).expiresAt
        } catch (error) {
            return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid invite resend expiry.' })
        }
    }

    const before = inviteSnapshot(context.invite)
    const updatedInvite = await updateOrganizationInviteAction({
        organizationId: context.organization.id,
        inviteId: context.invite.id,
        action: context.action,
        expiresAt: context.action === 'resend' ? expiresAt : undefined,
    }) as OrganizationInviteRow | null
    if (!updatedInvite) {
        const acceptedInvite = await loadInviteById(context.organization.id, context.invite.id)
        if (acceptedInvite?.status === 'accepted') {
            return sendAcceptedSupportInviteActionDenial(context.req, res, {
                actor: context.actor,
                organization: context.organization,
                invite: acceptedInvite,
                requestId: context.requestId,
                action: context.action,
                actionType: context.actionType,
                reason: context.reason,
                controls: context.controls,
            })
        }
        return res.status(404).send({ error: 'Invite not found for organization.' })
    }

    const after = inviteSnapshot(updatedInvite)
    await touchOrganization(context.organization.id)
    await recordSystemEvent(context.req, {
        actionType: context.actionType,
        actorId: context.actor.id,
        targetType: 'invite',
        targetId: updatedInvite.email,
        organizationId: context.organization.id,
        entityId: updatedInvite.id,
        requestId: context.requestId,
        severity: context.action === 'revoke' ? 'warning' : 'notice',
        outcome: 'success',
        reason: context.reason,
        context: {
            schemaVersion: 'support.invite_action.v1',
            action: context.action,
            requestId: context.requestId,
            inviteId: updatedInvite.id,
            email: updatedInvite.email,
            role: updatedInvite.role,
            before,
            after,
            correlationId: context.controls.correlationId,
            idempotencyKey: context.controls.idempotencyKey,
            supportSessionId: context.controls.supportSessionId || null,
            scope: context.controls.scope,
            handoffExpiresAt: context.controls.handoffExpiresAt,
            executor: supportInviteActionExecutorDetail({
                ...context,
                organizationId: context.organization.id,
                invite: updatedInvite,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
            noSilentMembershipMutation: true,
            mutation: 'invite_row_only',
            supportContext: cleanContext(context.req.body?.context),
        },
    })
    const auditEventIds = await loadSystemEventIds({ requestId: context.requestId, actionType: context.actionType, entityId: updatedInvite.id })
    return res.send({
        inviteAction: {
            schemaVersion: 'support.invite_action.v1',
            action: context.action,
            requestId: context.requestId,
            actorId: context.actor.id,
            organization: toOrganization(context.organization),
            invite: toInvite(updatedInvite),
            before,
            after,
            reason: context.reason,
            outcome: 'success',
            idempotencyKey: context.controls.idempotencyKey,
            correlationId: context.controls.correlationId,
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportInviteActionExecutorDetail({
                ...context,
                organizationId: context.organization.id,
                invite: updatedInvite,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
            executionReceipt: supportInviteActionExecutionReceipt({
                actorId: context.actor.id,
                organizationId: context.organization.id,
                ...context,
                invite: updatedInvite,
                before,
                after,
                outcome: 'success',
                auditEventIds,
                blockers: [],
            }),
            audit: {
                actionType: context.actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: context.action === 'revoke' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: supportInviteActionAuditQuery({
                    requestId: context.requestId,
                    organizationId: context.organization.id,
                    inviteId: updatedInvite.id,
                    correlationId: context.controls.correlationId,
                    idempotencyKey: context.controls.idempotencyKey,
                    reason: context.reason,
                    actionType: context.actionType,
                    outcome: 'success',
                }),
            },
            copyText: [
                `Support invite ${context.action} for ${updatedInvite.email}`,
                `Org: ${context.organization.name} (${context.organization.id})`,
                `Invite: ${updatedInvite.id}`,
                `Status: ${before.status} -> ${after.status}`,
                `Request: ${context.requestId}`,
                `Idempotency: ${context.controls.idempotencyKey}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${context.reason}`,
            ].join('\n'),
        },
    })
}
