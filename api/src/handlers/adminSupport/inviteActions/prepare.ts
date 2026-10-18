import type { FastifyReply } from 'fastify'
import { loadInviteById } from '../../organizations/invites/shared.ts'
import { normalizeOption, supportRequestId, supportText as text } from '#utils/support/adminSupportInput.ts'
import { requireAuditReason } from '#utils/systemEvent.ts'
import { requireAdminSupport } from '../auth.ts'
import { requireWritableSupportOrganization, validateSupportSessionForAction, loadSupportSuccessfulIdempotencyReceipt } from '../actionAccess.ts'
import { supportInviteActionExecutorControls } from './controls.ts'
import { sendInviteActionDenial } from './denialResponse.ts'
import { sendInviteActionReplay } from './replayResponse.ts'
import type { SupportInviteAction, SupportInviteActionContext, SupportInviteActionRequest } from './types.ts'

export async function prepareSupportInviteAction(req: SupportInviteActionRequest, res: FastifyReply): Promise<SupportInviteActionContext | undefined> {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const action = normalizeOption(req.body?.action, ['revoke', 'resend']) as SupportInviteAction | null
    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, 'Invite assistance action reason')
    } catch (error) {
        res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support invite action reason.' })
        return
    }
    if (!action) {
        res.status(400).send({ error: 'Invite assistance action must be revoke or resend.' })
        return
    }

    const organization = await requireWritableSupportOrganization(req.params.id, res)
    if (!organization) return

    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    const actionType = action === 'revoke'
        ? 'support.organization.invite_revoke'
        : 'support.organization.invite_resend'
    const controls = supportInviteActionExecutorControls(req, req.body, requestId, action)
    if (controls.error) {
        await sendInviteActionDenial({
            req, res, actor, organization, invite: null, requestId, action, actionType, reason,
            controls: controls.value, blocker: controls.error.code, status: controls.error.status,
            message: controls.error.message,
        })
        return
    }

    const invite = await loadInviteById(organization.id, req.params.inviteId)
    if (!invite) {
        res.status(404).send({ error: 'Invite not found for organization.' })
        return
    }

    const context: SupportInviteActionContext = {
        req, actor, organization, invite, requestId, action, actionType, reason, controls: controls.value,
    }
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: controls.value.supportSessionId,
        action: action === 'revoke' ? 'invite_revoke' : 'invite_resend',
        requiredScope: action === 'revoke' ? 'invite:revoke' : 'invite:resend',
        organizationId: organization.id,
    })
    if (sessionValidation.error) {
        await sendInviteActionDenial({
            ...context, res, blocker: sessionValidation.error.code, status: sessionValidation.error.status,
            message: sessionValidation.error.message,
        })
        return
    }

    const duplicate = await loadSupportSuccessfulIdempotencyReceipt({
        eventType: actionType,
        organizationId: organization.id,
        subjectId: invite.id,
        idempotencyKey: controls.value.idempotencyKey,
    })
    if (duplicate) {
        sendInviteActionReplay(context, res, duplicate)
        return
    }
    return context
}
