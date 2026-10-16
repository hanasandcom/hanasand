import type { FastifyReply } from 'fastify'
import { membershipSnapshot, toSupportMemberDetail } from '../cases/subjectMapping.ts'
import { toOrganization } from '#utils/organizations.ts'
import { cleanContext } from '#utils/support/adminSupportInput.ts'
import { loadSystemEventIds, recordSystemEvent } from '#utils/systemEvent.ts'
import {
    supportMemberRoleRecoveryAuditQuery,
} from './auditQuery.ts'
import { supportMemberRoleRecoveryExecutorDetail } from './executorReceipt.ts'
import type { MemberRoleRecoveryContext, MemberRoleRecoveryMutation } from './types.ts'

export async function sendMemberRoleRecoverySuccess(
    context: MemberRoleRecoveryContext,
    res: FastifyReply,
    mutation: Extract<MemberRoleRecoveryMutation, { error: null }>,
) {
    const before = membershipSnapshot(mutation.member)
    const updatedMember = { ...mutation.member, ...mutation.updatedMember }
    const after = membershipSnapshot(updatedMember)
    const severity = context.role === 'admin' || before.role === 'owner' ? 'warning' : 'notice'

    await recordSystemEvent(context.req, {
        actionType: context.actionType,
        actorId: context.actor.id,
        targetType: 'member',
        targetId: context.req.params.userId,
        organizationId: context.organization.id,
        entityId: context.req.params.userId,
        requestId: context.requestId,
        severity,
        outcome: 'success',
        reason: context.reason,
        context: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId: context.requestId,
            targetUserId: context.req.params.userId,
            previousRole: before.role,
            newRole: after.role,
            ownerCount: mutation.ownerCount,
            before,
            after,
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
                member: updatedMember,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
            noSilentMembershipMutation: true,
            mutation: 'member_role_only',
            supportContext: cleanContext(context.req.body?.context),
        },
    })

    const auditEventIds = await loadSystemEventIds({
        requestId: context.requestId,
        actionType: context.actionType,
        entityId: context.req.params.userId,
    })
    return res.send({
        memberRoleRecovery: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId: context.requestId,
            actorId: context.actor.id,
            organization: toOrganization(context.organization),
            member: toSupportMemberDetail(updatedMember),
            before,
            after,
            reason: context.reason,
            outcome: 'success',
            idempotencyKey: context.controls.idempotencyKey,
            correlationId: context.controls.correlationId,
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
                member: updatedMember,
                before,
                after,
                outcome: 'success',
                blockers: [],
                auditEventIds,
            }),
            audit: {
                actionType: context.actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity,
                eventIds: auditEventIds,
                query: supportMemberRoleRecoveryAuditQuery({
                    requestId: context.requestId,
                    organizationId: context.organization.id,
                    userId: context.req.params.userId,
                    correlationId: context.controls.correlationId,
                    idempotencyKey: context.controls.idempotencyKey,
                    reason: context.reason,
                    outcome: 'success',
                }),
            },
            copyText: [
                `Support member role recovery for ${context.req.params.userId}`,
                `Org: ${context.organization.name} (${context.organization.id})`,
                `Role: ${before.role} -> ${after.role}`,
                `Request: ${context.requestId}`,
                `Idempotency: ${context.controls.idempotencyKey}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${context.reason}`,
            ].join('\n'),
        },
    })
}
