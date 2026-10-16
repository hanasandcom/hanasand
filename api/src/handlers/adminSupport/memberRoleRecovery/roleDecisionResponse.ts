import type { FastifyReply } from 'fastify'
import { membershipSnapshot, toSupportMemberDetail } from '../cases/subjectMapping.ts'
import { toOrganization } from '#utils/organizations.ts'
import { cleanContext } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'
import { supportMemberRoleRecoveryExecutorDetail } from './executorReceipt.ts'
import type { MemberRoleRecoveryContext } from './types.ts'

export async function sendRoleDecisionResponse(
    context: MemberRoleRecoveryContext,
    res: FastifyReply,
    outcome: 'denied' | 'failed',
    error: string,
    ownerCount: number,
) {
    const before = membershipSnapshot(context.member)
    await recordSystemEvent(context.req, {
        actionType: context.actionType,
        actorId: context.actor.id,
        targetType: 'member',
        targetId: context.req.params.userId,
        organizationId: context.organization.id,
        entityId: context.req.params.userId,
        requestId: context.requestId,
        severity: 'notice',
        outcome,
        reason: context.reason,
        context: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId: context.requestId,
            targetUserId: context.req.params.userId,
            requestedRole: context.role,
            ownerCount,
            before,
            after: before,
            correlationId: context.controls.correlationId,
            idempotencyKey: context.controls.idempotencyKey,
            supportSessionId: context.controls.supportSessionId || null,
            scope: context.controls.scope,
            handoffExpiresAt: context.controls.handoffExpiresAt,
            executor: supportMemberRoleRecoveryExecutorDetail({
                actorId: context.actor.id,
                organizationId: context.organization.id,
                userId: context.req.params.userId,
                requestId: context.requestId,
                reason: context.reason,
                requestedRole: context.role,
                controls: context.controls,
                member: context.member,
                before,
                after: before,
                outcome,
                blockers: [error],
            }),
            noSilentMembershipMutation: true,
            mutation: 'none',
            error,
            supportContext: cleanContext(context.req.body?.context),
        },
    })

    const auditEventIds = await loadSystemEventIds({
        requestId: context.requestId,
        actionType: context.actionType,
        entityId: context.req.params.userId,
    })
    const permissionDenied = outcome === 'denied'
    return res.status(permissionDenied ? 403 : 409).send({
        error: permissionDenied ? error : 'Member already has the requested role.',
        memberRoleRecovery: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId: context.requestId,
            actorId: context.actor.id,
            organization: toOrganization(context.organization),
            member: toSupportMemberDetail(context.member),
            before,
            after: before,
            requestedRole: context.role,
            outcome,
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportMemberRoleRecoveryExecutorDetail({
                actorId: context.actor.id,
                organizationId: context.organization.id,
                userId: context.req.params.userId,
                requestId: context.requestId,
                reason: context.reason,
                requestedRole: context.role,
                controls: context.controls,
                member: context.member,
                before,
                after: before,
                outcome,
                blockers: [error],
                auditEventIds,
            }),
        },
    })
}
