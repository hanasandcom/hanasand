import type { FastifyReply, FastifyRequest } from 'fastify'
import recordLog from '#utils/logs/recordLog.ts'
import { organizationAccessDenial } from '#utils/organizations.ts'

export function logOrganizationEvent(req: FastifyRequest, action: string, organizationId: string, actorId: string, metadata: Record<string, unknown>) {
    void recordLog({
        service: 'hanasand-api',
        level: 'info',
        message: action,
        metadata: {
            category: 'organization',
            action,
            organizationId,
            actorId,
            ...metadata,
        },
    }).catch(error => req.log.warn({ error, action, organizationId }, 'Failed to persist organization event log'))
}

export function sendOrganizationAccessDenial(
    req: FastifyRequest,
    res: FastifyReply,
    input: {
        organizationId: string
        actorId: string
        route: Parameters<typeof organizationAccessDenial>[0]['route']
        requestId?: string | null
    }
) {
    const denial = organizationAccessDenial({
        ...input,
        requestId: input.requestId ?? (req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null),
    })
    logOrganizationEvent(req, denial.serviceLogAction, input.organizationId, input.actorId, {
        requestId: denial.requestId,
        route: denial.route,
        blockerCode: denial.blockerCode,
        denialReason: denial.denialReason,
    })
    return res.status(denial.statusCode).send({ error: denial.message, organizationAccessDenial: denial })
}
