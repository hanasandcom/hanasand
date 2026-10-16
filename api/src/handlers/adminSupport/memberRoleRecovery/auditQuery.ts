import { supportExecutorAuditQuery } from '../executorAudit.ts'

export function supportMemberRoleRecoveryAuditQuery(input: {
    requestId: string
    organizationId: string
    userId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    outcome: string
}) {
    return supportExecutorAuditQuery({
        ...input,
        entityId: input.userId,
        targetId: input.userId,
        actionType: 'support.organization.member_role_recovery',
    })
}
