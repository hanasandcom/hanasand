import { supportExecutorAuditQuery } from '../executorAudit.ts'

export function supportInviteActionAuditQuery(input: {
    requestId: string
    organizationId: string
    inviteId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    actionType: string
    outcome: string
}) {
    return supportExecutorAuditQuery({ ...input, entityId: input.inviteId })
}
