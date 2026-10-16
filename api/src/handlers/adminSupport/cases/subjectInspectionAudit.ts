import type { FastifyRequest } from 'fastify'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { supportInspectionAuditContext, supportInspectionAuditMetadata } from '#utils/support/adminSupportInput.ts'

export function recordSupportSubjectInspection(input: {
    req: FastifyRequest
    actorId: string
    kind: 'organization' | 'user'
    targetId: string
    organizationId?: string
    metadata: ReturnType<typeof supportInspectionAuditMetadata>
    context: Record<string, unknown>
}) {
    return recordSystemEvent(input.req, {
        actionType: `support.${input.kind}.inspect`,
        actorId: input.actorId,
        targetType: input.kind,
        targetId: input.targetId,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        entityId: input.targetId,
        requestId: input.metadata.requestId,
        severity: 'info',
        outcome: 'success',
        reason: input.metadata.reason || undefined,
        context: supportInspectionAuditContext(input.metadata, input.context),
    })
}
