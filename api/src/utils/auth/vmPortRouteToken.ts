import type { FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import config from '#constants'

export default function hasVmPortRouteToken(req: FastifyRequest) {
    const header = req.headers.authorization
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
    return [config.vm_port_route_token, config.vm_api_token].some(expected =>
        typeof expected === 'string' && expected.length > 0 && token.length === expected.length
        && timingSafeEqual(Buffer.from(token), Buffer.from(expected)))
}
