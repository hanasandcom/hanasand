import type { FastifyReply, FastifyRequest } from 'fastify'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { supportInspectionAuditContext, supportInspectionAuditMetadata } from '#utils/support/adminSupportInput.ts'

export async function sendOrganizationEntityInspectionNotFound(input: {
    req: FastifyRequest
    res: FastifyReply
    actorId: string
    metadata: ReturnType<typeof supportInspectionAuditMetadata>
    kind: 'organization' | 'user' | 'invite' | 'member'
    targetId: string
    organizationId?: string
    error: 'organization_not_found' | 'user_not_found' | 'invite_not_found' | 'member_not_found'
    contextKey?: 'inviteId' | 'userId'
    responseError: string
}) {
    await recordSystemEvent(input.req, {
        actionType: input.kind === 'organization'
            ? 'support.organization.inspect'
            : input.kind === 'user'
                ? 'support.user.inspect'
                : `support.organization.${input.kind}.inspect`,
        actorId: input.actorId,
        targetType: input.kind,
        targetId: input.targetId,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        entityId: input.targetId,
        requestId: input.metadata.requestId,
        severity: 'notice',
        outcome: 'failed',
        reason: input.metadata.reason || undefined,
        context: supportInspectionAuditContext(input.metadata, {
            error: input.error,
            ...(input.contextKey ? { [input.contextKey]: input.targetId } : {}),
        }),
    })
    return input.res.status(404).send({ error: input.responseError })
}
