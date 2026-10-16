import type { FastifyRequest } from 'fastify'
import { recordSystemEvent } from '#utils/systemEvent.ts'

type ScheduledDeletionAudit = {
    actorId: string
    targetId: string
    targetName: string
    source: 'auth' | 'admin'
    wasHanasandInternalMember: boolean
}

export async function recordScheduledDeletionAudit(req: FastifyRequest, audit: ScheduledDeletionAudit) {
    const { actorId, targetId, targetName, source, wasHanasandInternalMember } = audit
    const context = { deletionMode: 'scheduled', targetName, targetId }

    await recordSystemEvent(req, {
        actionType: 'user.account.deleted',
        actorId,
        source,
        targetType: 'user',
        targetId,
        severity: wasHanasandInternalMember ? 'critical' : 'warning',
        context: { ...context, hanasandOrganizationMember: wasHanasandInternalMember },
    })

    if (wasHanasandInternalMember) {
        await recordSystemEvent(req, {
            actionType: 'admin.account.deleted',
            actorId,
            source,
            targetType: 'user',
            targetId,
            severity: 'critical',
            context,
        })
    }
}
