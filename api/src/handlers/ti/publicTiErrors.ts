import type { FastifyReply } from 'fastify'

export function publicError(code: string, message: string, requestId: string) { return { code, message, requestId } }
export function sendError(reply: FastifyReply, requestId: string, status: number, code: string, message: string) { return reply.status(status).send({ error: publicError(code, message, requestId) }) }

export function normalizeError(payload: unknown, status: number, requestId: string) {
    let body = payload
    if (typeof payload === 'string') { try { body = JSON.parse(payload) } catch { body = {} } }
    const input = record(body)
    const nested = record(input.error)
    if (Object.keys(nested).length) return { error: publicError(text(nested.code) ?? statusCode(status), text(nested.message) ?? statusMessage(status), requestId) }
    const legacy = text(input.error)
    return { error: publicError(legacy && /^[a-z0-9_]+$/.test(legacy) ? legacy : statusCode(status), text(input.message) ?? (legacy && !/^[a-z0-9_]+$/.test(legacy) ? legacy : statusMessage(status)), requestId) }
}

function statusCode(status: number) { return status === 400 ? 'invalid_request' : status === 401 ? 'authentication_required' : status === 403 ? 'scope_forbidden' : status === 404 ? 'not_found' : status === 429 ? 'rate_limit_exceeded' : status >= 500 ? 'internal_error' : 'request_failed' }
function statusMessage(status: number) { return status === 400 ? 'The request is invalid.' : status === 401 ? 'Authentication is required.' : status === 403 ? 'The credential does not permit this operation.' : status === 404 ? 'The requested resource was not found.' : status === 429 ? 'The request rate limit was exceeded.' : 'The request could not be completed.' }
function record(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {} }
function text(value: unknown) { return typeof value === 'string' && value.length ? value : undefined }
