import type { FastifyRequest } from 'fastify'
import run from '#db'
import { roleCanEditOrganization } from '#utils/organizationRoles.ts'
import { redactLogValue } from '#utils/logs/redact.ts'
import type { Event, ReadAwareRun } from './types.ts'

export function object(value: unknown): Event {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Event : {}
}

export function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function canManageRules(role: string) {
    return roleCanEditOrganization(role)
}

export function deviceIdFor(event: Event) {
    return stringValue(object(event.device).id || event.device_id)
}

export function bearer(req: FastifyRequest) {
    const apiKey = req.headers['x-api-key']
    if (typeof apiKey === 'string' && apiKey.trim()) return apiKey.trim()
    const value = req.headers.authorization
    return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

export function redact(value: unknown): Event {
    return redactLogValue(value) as Event
}

export function readDatabase<T>(work: () => Promise<T>): Promise<T> {
    return (run as ReadAwareRun).withReadDatabase?.(work) || work()
}

export function normalizeParserVersion(value: unknown) {
    const version = String(value || 'event.v1')
    return version === 'mill.v1' ? 'event.v1' : version
}
