import type { FastifyReply, FastifyRequest } from 'fastify'
import { touchOrganization, updateOrganizationInviteAction } from '#utils/db/identityDataWrites.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import {
    normalizeInviteActionInput,
    organizationInviteActionDenial,
    roleCanManageOrganization,
    toInvite,
    type InviteActionInput,
    type OrganizationInviteRow,
} from '#utils/organizations.ts'
import { logOrganizationEvent } from '../audit.ts'
import { inactiveOrganizationMutationBlocker, privacyDeletionMutationBlocker, sendOrganizationLifecycleBlocker } from '../lifecycle.ts'
import { loadRequiredOrganizationMemberRequest } from '../requestContext.ts'
import { loadInviteById, sendInviteManagementDenial } from './shared.ts'
import { buildOrganizationInviteActionReceipt } from './actionReceipt.ts'

type OrganizationParams = { id: string }
type OrganizationInviteParams = OrganizationParams & { inviteId: string }

export async function postOrganizationInviteAction(req: FastifyRequest<{ Params: OrganizationInviteParams, Body: InviteActionInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const deletionBlocker = privacyDeletionMutationBlocker(organization, 'change invites')
    if (deletionBlocker) return sendOrganizationLifecycleBlocker(req, res, deletionBlocker, userId, organization.role)

    if (!roleCanManageOrganization(organization.role)) {
        const action = req.body?.action === 'revoke'
            ? 'revoke_invite'
            : req.body?.action === 'resend'
                ? 'resend_invite'
                : 'manage_invites'
        return sendInviteManagementDenial(req, res, organization, userId, {
            action,
            inviteId: req.params.inviteId,
            requestId: typeof req.body?.requestId === 'string' ? req.body.requestId : typeof req.body?.request_id === 'string' ? req.body.request_id : null,
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can manage invites.',
        })
    }

    let input: ReturnType<typeof normalizeInviteActionInput>
    try {
        input = normalizeInviteActionInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid invite action.' })
    }

    const existing = await loadInviteById(req.params.id, req.params.inviteId)
    if (!existing) {
        return res.status(404).send({ error: 'Invite not found.' })
    }

    const denyAcceptedInviteAction = (invite: OrganizationInviteRow) => {
        const message = 'Accepted invites cannot be revoked or resent; manage the member instead.'
        const denial = organizationInviteActionDenial({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            invite,
            action: input.action,
            requestId: input.requestId,
            reason: input.reason,
            message,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            inviteId: req.params.inviteId,
            role: invite.role,
            actorRole: organization.role,
            action: input.action,
            blockerCode: denial.blockerCode,
            reason: input.reason,
        })
        return res.status(409).send({ error: message, inviteActionDenial: denial })
    }
    if (existing.status === 'accepted') return denyAcceptedInviteAction(existing)

    const lifecycleBlocker = input.action === 'resend'
        ? inactiveOrganizationMutationBlocker(organization, 'resend invites')
        : null
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    const resendExpiresAt = input.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const invite = await updateOrganizationInviteAction({
        organizationId: req.params.id,
        inviteId: req.params.inviteId,
        action: input.action,
        expiresAt: input.action === 'resend' ? resendExpiresAt : undefined,
    }) as OrganizationInviteRow | null

    if (!invite) {
        const currentInvite = await loadInviteById(req.params.id, req.params.inviteId)
        if (currentInvite?.status === 'accepted') return denyAcceptedInviteAction(currentInvite)
        return res.status(404).send({ error: 'Invite not found.' })
    }

    await touchOrganization(req.params.id)
    const serviceLogAction = input.action === 'resend'
        ? 'organization_invite_resent'
        : 'organization_invite_revoked'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        inviteId: req.params.inviteId,
        email: existing.email,
        role: existing.role,
        previousStatus: existing.status,
        newStatus: input.action === 'resend' ? 'pending' : 'revoked',
        expiresAt: input.action === 'resend' ? resendExpiresAt : null,
        reason: input.reason,
    })
    await recordSystemEvent(req, {
        actionType: input.action === 'resend' ? 'organization.membership.invite_resent' : 'organization.membership.invite_revoked',
        actorId: userId,
        organizationId: req.params.id,
        targetType: 'organization_invite',
        targetId: req.params.inviteId,
        entityId: req.params.id,
        context: { role: existing.role, previousStatus: existing.status, reason: input.reason },
    })

    return res.send({
        invite: toInvite(invite),
        inviteAction: buildOrganizationInviteActionReceipt({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            invite,
            action: input.action,
            previousStatus: existing.status,
            reason: input.reason,
            requestId: input.requestId ?? null,
            serviceLogAction,
        }),
    })
}

