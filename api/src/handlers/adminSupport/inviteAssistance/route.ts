import type { FastifyReply, FastifyRequest } from 'fastify'
import { cleanContext, supportError, supportRequestId } from '#utils/support/adminSupportInput.ts'
import { requireAuditReason } from '#utils/systemEvent.ts'
import { normalizeInviteInput } from '#utils/organizations.ts'
import { requireAdminSupport } from '../auth.ts'
import { loadSupportSuccessfulIdempotencyReceipt, requireWritableSupportOrganization, validateSupportSessionForAction } from '../actionAccess.ts'
import { supportInviteAssistExecutorBlocker, supportInviteAssistExecutorControls, recordSupportInviteAssistExecutorBlock } from './executor.ts'
import { organizationMembershipAvailability as loadOrganizationAvailability } from '#utils/organizationMemberships.ts'
import { sendInviteAssistanceReplay } from './replay.ts'
import { createSupportInvites } from './create.ts'
import type { OrganizationParams, SupportInviteBody } from './types.ts'

export async function postSupportOrganizationInvite(req: FastifyRequest<{ Params: OrganizationParams, Body: SupportInviteBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    let input: ReturnType<typeof normalizeInviteInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Invite assistance reason')
        input = normalizeInviteInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support invite request.' })
    }

    const organization = await requireWritableSupportOrganization(req.params.id, res)
    if (!organization) return

    const requestId = input.requestId || supportRequestId(req)
    const controls = supportInviteAssistExecutorControls(req, req.body, requestId)
    if (controls.error) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: controls.error.code,
            input,
            controls: controls.value,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(controls.error.status).send(supportError(controls.error.code, controls.error.message, {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: controls.value,
                input,
                blockers: [controls.error.code],
            }),
        }))
    }
    const executorControls = controls.value
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: executorControls.supportSessionId,
        action: 'invite_assist',
        requiredScope: 'invite:create',
        organizationId: organization.id,
    })
    if (sessionValidation.error) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: sessionValidation.error.code,
            input,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    const duplicate = await loadSupportSuccessfulIdempotencyReceipt({
        eventType: 'support.organization.invite_assist',
        organizationId: organization.id,
        idempotencyKey: executorControls.idempotencyKey,
    })
    if (duplicate) {
        return sendInviteAssistanceReplay({ res, actorId: actor.id, organization, reason, inviteInput: input, controls: executorControls, duplicate })
    }

    const availability = await loadOrganizationAvailability([organization.id])
    const hasAvailableAdmin = availability[0]?.hasAvailableAdmin === true
    if (hasAvailableAdmin) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: 'active_admin_available',
            input,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(409).send(supportError('active_admin_available', 'An active organization admin is available; support invite assistance requires unavailable org administration.', {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                blockers: ['active_admin_available'],
            }),
        }))
    }
    return createSupportInvites({ req, res, actorId: actor.id, organization, reason, inviteInput: input, requestId, controls: executorControls, supportContext: cleanContext(req.body?.context) })
}
