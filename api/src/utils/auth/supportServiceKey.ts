import { timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'

export function hasTrustedSupportServiceKey(headers: FastifyRequest['headers']) {
    const expected = process.env.SUPPORT_AUTH_SERVICE_KEY || process.env.SUPPORT_SERVICE_KEY
    const received = headers['x-support-auth-key']
    return Boolean(expected && expected.length >= 32 && typeof received === 'string'
        && Buffer.byteLength(received) === Buffer.byteLength(expected)
        && timingSafeEqual(Buffer.from(received), Buffer.from(expected)))
}
