import type { FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import config from '#constants'

export default function hasVmPortRouteToken(req: FastifyRequest) {
    const header = req.headers.authorization
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
    const expected = config.vm_port_route_token || ''
    return token.length === expected.length && expected.length > 0
        && timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}
