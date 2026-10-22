import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'

export async function requireHanasandInternalAccess(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        res.status(401).send({ error: 'Unauthorized.' })
        return false
    }
    const internalAccess = await hasHanasandInternalRouteAccess(req)
    if (!internalAccess.valid) {
        res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })
        return false
    }
    return id
}
