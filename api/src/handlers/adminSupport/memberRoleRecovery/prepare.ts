import type { FastifyReply } from 'fastify'
import { requireAdminSupport } from '../auth.ts'
import {
    loadSupportSuccessfulIdempotencyReceipt,
    requireWritableSupportOrganization,
    validateSupportSessionForAction,
} from '../actionAccess.ts'
import { loadSupportMemberDetail } from '../cases/organizationReadData.ts'
import { membershipSnapshot } from '../cases/subjectMapping.ts'
import { organizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { normalizeMemberRoleInput } from '#utils/organizations.ts'
import { supportRequestId } from '#utils/support/adminSupportInput.ts'
import { requireAuditReason } from '#utils/systemEvent.ts'
import { supportMemberRoleRecoveryExecutorControls } from './controls.ts'
import { sendMemberRoleRecoveryBlock } from './blockResponse.ts'
import { sendMemberRoleRecoveryReplay } from './replayResponse.ts'
import type { MemberRoleRecoveryContext, MemberRoleRecoveryRequest } from './types.ts'

const ACTION_TYPE = 'support.organization.member_role_recovery'

export async function prepareMemberRoleRecovery(
    req: MemberRoleRecoveryRequest,
    res: FastifyReply,
): Promise<MemberRoleRecoveryContext | null> {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return null

    let reason: string
    let input: ReturnType<typeof normalizeMemberRoleInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Member role recovery reason')
        input = normalizeMemberRoleInput({
            role: req.body?.role,
            reason,
            requestId: req.body?.requestId,
            request_id: req.body?.request_id,
        })
    } catch (error) {
        res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support member role recovery request.' })
        return null
    }

    const organization = await requireWritableSupportOrganization(req.params.id, res)
    if (!organization) return null

    const requestId = input.requestId || supportRequestId(req)
    const controls = supportMemberRoleRecoveryExecutorControls(req, req.body, requestId)
    const contextBase = {
        req,
        actor,
        organization,
        reason,
        requestId,
        actionType: ACTION_TYPE,
        role: input.role,
        controls: controls.value,
    } as const

    if (controls.error) {
        await sendMemberRoleRecoveryBlock(
            res,
            { ...contextBase, member: null },
            controls.error.code,
            controls.error.status,
            controls.error.message,
        )
        return null
    }

    const member = await loadSupportMemberDetail(req.params.id, req.params.userId)
    if (!member) {
        res.status(404).send({ error: 'Active organization member not found.' })
        return null
    }
    const context = { ...contextBase, member }

    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: controls.value.supportSessionId,
        action: 'member_role_recovery',
        requiredScope: 'member:role_recovery',
        organizationId: organization.id,
        targetUserId: req.params.userId,
    })
    if (sessionValidation.error) {
        await sendMemberRoleRecoveryBlock(
            res,
            context,
            sessionValidation.error.code,
            sessionValidation.error.status,
            sessionValidation.error.message,
        )
        return null
    }

    const duplicate = await loadSupportSuccessfulIdempotencyReceipt({
        eventType: ACTION_TYPE,
        organizationId: organization.id,
        subjectId: req.params.userId,
        idempotencyKey: controls.value.idempotencyKey,
    })
    if (duplicate) {
        sendMemberRoleRecoveryReplay(res, context, duplicate)
        return null
    }

    const before = membershipSnapshot(member)
    if (member.status !== 'active') {
        await sendMemberRoleRecoveryBlock(
            res,
            context,
            'revoked_member',
            409,
            'Support role recovery requires an active organization member; inspect removed membership state first.',
            before,
        )
        return null
    }

    const availability = await organizationMembershipAvailability([organization.id])
    if (availability[0]?.hasAvailableAdmin === true) {
        await sendMemberRoleRecoveryBlock(
            res,
            context,
            'active_admin_available',
            409,
            'An active organization admin is available; support member role recovery requires unavailable org administration.',
            before,
        )
        return null
    }

    return context
}
