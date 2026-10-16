import type { FastifyReply } from 'fastify'
import { membershipSnapshot, toSupportMemberDetail } from '../cases/subjectMapping.ts'
import { toOrganization } from '#utils/organizations.ts'
import {
    supportMemberRoleRecoveryAuditQuery,
} from './auditQuery.ts'
import { supportMemberRoleRecoveryExecutorDetail } from './executorReceipt.ts'
import type { MemberRoleRecoveryContext } from './types.ts'

export function sendMemberRoleRecoveryReplay(
    res: FastifyReply,
    context: MemberRoleRecoveryContext,
    duplicate: { id: number; request_id: string },
) {
    const snapshot = membershipSnapshot(context.member)
    const auditEventIds = [Number(duplicate.id)].filter(Number.isFinite)
    return res.send({
        memberRoleRecovery: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId: duplicate.request_id,
            actorId: context.actor.id,
            organization: toOrganization(context.organization),
            member: toSupportMemberDetail(context.member),
            before: snapshot,
            after: snapshot,
            requestedRole: context.role,
            reason: context.reason,
            outcome: 'success',
            idempotentReplay: true,
            blockers: ['duplicate_idempotency_key'],
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportMemberRoleRecoveryExecutorDetail({
                actorId: context.actor.id,
                organizationId: context.organization.id,
                userId: context.req.params.userId,
                requestId: duplicate.request_id,
                reason: context.reason,
                requestedRole: context.role,
                controls: context.controls,
                member: context.member,
                before: snapshot,
                after: snapshot,
                outcome: 'success',
                blockers: ['duplicate_idempotency_key'],
                auditEventIds,
            }),
            audit: {
                actionType: context.actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: context.role === 'admin' || snapshot.role === 'owner' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: supportMemberRoleRecoveryAuditQuery({
                    requestId: duplicate.request_id,
                    organizationId: context.organization.id,
                    userId: context.req.params.userId,
                    correlationId: context.controls.correlationId,
                    idempotencyKey: context.controls.idempotencyKey,
                    reason: context.reason,
                    outcome: 'success',
                }),
            },
        },
    })
}
