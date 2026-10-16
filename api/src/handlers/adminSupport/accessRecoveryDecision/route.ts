import type { FastifyReply } from 'fastify'
import { requireAdminSupport } from '../auth.ts'
import { loadAccessRecoveryApproval } from '../cases/accessRecoveryApprovalStore.ts'
import { recordSystemEvent, requireAuditReason } from '#utils/systemEvent.ts'
import { hasOrganizationPrivacyDeletionMarker } from '#utils/organizationLifecycle.ts'
import { supportSessionIdFromRequest, cleanContext } from '#utils/support/adminSupportInput.ts'
import { validateSupportSessionForAction } from '../actionAccess.ts'
import { mutateAccessRecoveryDecision } from './mutation.ts'
import { sendAccessRecoveryDecisionFailure } from './failureResponse.ts'
import { sendAccessRecoveryDecisionSuccess } from './successResponse.ts'
import type { AccessRecoveryDecision, AccessRecoveryDecisionRequest } from './types.ts'

export async function postSupportAccessRecoveryApprove(req: AccessRecoveryDecisionRequest, res: FastifyReply) {
    return decideSupportAccessRecovery(req, res, 'approved')
}

export async function postSupportAccessRecoveryDeny(req: AccessRecoveryDecisionRequest, res: FastifyReply) {
    return decideSupportAccessRecovery(req, res, 'denied')
}

async function decideSupportAccessRecovery(req: AccessRecoveryDecisionRequest, res: FastifyReply, decision: AccessRecoveryDecision) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return
    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, decision === 'approved' ? 'Access recovery approval reason' : 'Access recovery denial reason')
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid access recovery decision reason.' })
    }

    const current = await loadAccessRecoveryApproval(req.params.requestId)
    if (!current) {
        await recordSystemEvent(req, {
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            actorId: actor.id,
            targetType: 'access_recovery',
            targetId: req.params.requestId,
            entityId: req.params.requestId,
            requestId: req.params.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason,
            context: { error: 'access_recovery_request_not_found' },
        })
        return res.status(404).send({ error: 'Access recovery request not found.' })
    }
    if (await hasOrganizationPrivacyDeletionMarker(current.organization_id)) {
        return res.status(409).send({ error: 'Organization deletion is in progress; support writes are blocked.' })
    }

    const supportSessionId = supportSessionIdFromRequest(req, req.body)
    const requiredScope = decision === 'approved' ? 'recovery:approve' : 'recovery:deny'
    const receiptContext = { actorId: actor.id, decision, reason, supportSessionId, requiredScope }
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId,
        action: 'access_recovery',
        requiredScope,
        organizationId: current.organization_id,
        targetUserId: current.target_user_id || null,
    })
    if (sessionValidation.error) {
        const error = sessionValidation.error
        return sendAccessRecoveryDecisionFailure({
            req, res, actorId: actor.id, current, decision, reason, outcome: 'denied',
            blocker: error.code, message: error.message, status: error.status, receiptContext,
            useSupportError: true,
            auditExtra: {
                error: error.code,
                schemaVersion: 'support.access_recovery.session_guard.v1',
                supportSessionId: supportSessionId || null,
                requiredScope,
                blockerCode: error.code,
                noSilentMembershipMutation: true,
                mutation: 'none',
                supportContext: cleanContext(req.body?.context),
                redactionRequired: true,
            },
            responseExtra: {
                schemaVersion: 'support.access_recovery.session_guard.v1',
                supportSessionId: supportSessionId || null,
                requiredScope,
                noSilentMembershipMutation: true,
            },
        })
    }

    if (!current.approval_required) {
        return sendAccessRecoveryDecisionFailure({
            req, res, actorId: actor.id, current, decision, reason, outcome: 'failed',
            blocker: 'approval_not_required', message: 'This access recovery request does not require approval.', status: 409, receiptContext,
            auditExtra: { error: 'approval_not_required' },
        })
    }
    if (current.requested_by === actor.id) {
        return sendAccessRecoveryDecisionFailure({
            req, res, actorId: actor.id, current, decision, reason, outcome: 'denied',
            blocker: 'self_approval_denied', message: 'Access recovery approval requires a different admin than the requester.', status: 403, receiptContext,
            auditExtra: { error: 'self_approval_denied' },
        })
    }
    if (current.status !== 'pending') {
        return sendAccessRecoveryDecisionFailure({
            req, res, actorId: actor.id, current, decision, reason, outcome: 'failed',
            blocker: 'approval_not_pending', message: `Access recovery request is already ${current.status}.`, status: 409, receiptContext,
            auditExtra: { error: 'approval_not_pending', status: current.status },
        })
    }

    const mutation = await mutateAccessRecoveryDecision({ requestId: req.params.requestId, actorId: actor.id, decision, reason })
    if (mutation.error) {
        const currentApproval = 'approval' in mutation && mutation.approval
            ? { ...mutation.approval, ...('inviteStatus' in mutation ? { invite_status: mutation.inviteStatus } : {}) }
            : current
        const blocker = mutation.error === 'invite_not_mutable' ? 'accepted_invite_not_mutable_by_support_action' : mutation.error
        const message = mutation.error === 'approval_not_pending'
            ? `Access recovery request is already ${currentApproval.status}.`
            : mutation.error === 'access_recovery_request_not_found'
                ? 'Access recovery request not found.'
                : mutation.error === 'organization_deletion_in_progress'
                    ? 'Organization deletion is in progress; support writes are blocked.'
                    : mutation.error === 'access_recovery_invite_expired'
                        ? 'The access recovery invite has expired; create a fresh recovery request.'
                        : 'The access recovery invite changed and could not be updated.'
        return sendAccessRecoveryDecisionFailure({
            req, res, actorId: actor.id, current: currentApproval, decision, reason, outcome: 'failed',
            blocker, message, status: mutation.error === 'access_recovery_request_not_found' ? 404 : 409, receiptContext,
            auditExtra: {
                error: blocker,
                blockerCode: blocker,
                inviteStatus: 'inviteStatus' in mutation ? mutation.inviteStatus : currentApproval.invite_status,
                mutation: 'none',
                supportSessionId: supportSessionId || null,
                supportContext: cleanContext(req.body?.context),
            },
        })
    }
    return sendAccessRecoveryDecisionSuccess({
        req, res, actorId: actor.id, current: mutation.approval, updatedApproval: mutation.updatedApproval,
        invite: mutation.invite, decision, reason, receiptContext,
    })
}
