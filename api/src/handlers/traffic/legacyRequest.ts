import type { FastifyRequest } from 'fastify'

export function readTrafficQueryString(req: FastifyRequest, key: string) {
    const query = req.query as Record<string, string | string[] | undefined>
    const value = query[key]
    return Array.isArray(value) ? value[0] : value
}
