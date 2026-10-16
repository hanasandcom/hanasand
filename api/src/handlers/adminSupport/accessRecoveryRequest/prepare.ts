import type { FastifyReply } from 'fastify'
import { normalizeInviteInput } from '#utils/organizations.ts'
import { cleanContext, supportRequestId, supportSessionIdFromRequest, supportText as text } from '#utils/support/adminSupportInput.ts'
import { requireAuditReason } from '#utils/systemEvent.ts'
import { requireAdminSupport } from '../auth.ts'
import { requireWritableSupportOrganization, validateSupportSessionForAction } from '../actionAccess.ts'
import { sendAccessRecoverySessionDenial } from './sessionDenial.ts'
import type { PreparedSupportAccessRecoveryRequest, SupportAccessRecoveryRequest } from './types.ts'

export async function prepareSupportAccessRecoveryRequest(req: SupportAccessRecoveryRequest, res: FastifyReply): Promise<PreparedSupportAccessRecoveryRequest | undefined> {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    let input: ReturnType<typeof normalizeInviteInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Access recovery reason')
        input = normalizeInviteInput({
            email: req.body?.email,
            emails: req.body?.emails,
            role: req.body?.role || 'system',
            expiresAt: req.body?.expiresAt,
        })
    } catch (error) {
        res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid access recovery request.' })
        return
    }
    if (input.emails.length !== 1) {
        res.status(400).send({ error: 'Access recovery creates one controlled invite at a time.' })
        return
    }

    const organization = await requireWritableSupportOrganization(req.params.id, res)
    if (!organization) return

    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    const targetUserId = text(req.body?.targetUserId)
    const supportSessionId = supportSessionIdFromRequest(req, req.body)
    const supportContext = cleanContext(req.body?.context)
    const context = { req, actor, organization, requestId, reason, input, targetUserId, supportSessionId, supportContext }
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId,
        action: 'access_recovery',
        requiredScope: 'recovery:invite',
        organizationId: organization.id,
        targetUserId: targetUserId || null,
    })
    if (sessionValidation.error) {
        await sendAccessRecoverySessionDenial(context, res, sessionValidation.error)
        return
    }
    return context
}
