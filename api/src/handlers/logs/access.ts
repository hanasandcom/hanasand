import type { FastifyReply, FastifyRequest } from 'fastify'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export async function requireLogAccess(req: FastifyRequest, res: FastifyReply) {
    if (!(await tokenWrapper(req, res)).valid) {
        res.status(401).send({ error: 'Unauthorized.' })
        return false
    }
    if (!(await hasHanasandInternalRouteAccess(req)).valid) {
        res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })
        return false
    }
    return true
}
