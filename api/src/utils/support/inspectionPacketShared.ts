import { supportText as text } from './adminSupportInput.ts'

export type SupportInspectionPacket = Record<string, any> & {
    schemaVersion: string
    generatedAt: string
    blockers: string[]
    copyText: string
    redacted?: boolean
    noMutation?: boolean
}

export type SupportTimelineFilter = {
    q?: string
    org: string
    user: string
    email: string
    request: string
    entity: string
    entityType: string
    supportSession: string
    workflow?: string
    action: string
    severity: string
    outcome: string
    source: string
    service: string
    blocker: string
    reason: string
    scope?: string
    context: string
    from: string
    to: string
    limit: number
    unsupported: string[]
}

export const supportInspectionFilters = new Set([
    'q',
    'org',
    'orgId',
    'user',
    'userId',
    'email',
    'request',
    'requestId',
    'entity',
    'entityId',
    'entityType',
    'session',
    'supportSession',
    'supportSessionId',
    'workflow',
    'bridgeWorkflow',
    'sourceWorkflow',
    'action',
    'severity',
    'outcome',
    'source',
    'service',
    'blocker',
    'blockerCode',
    'prepareAction',
    'reason',
    'supportReason',
    'supportScope',
    'context',
    'supportContext',
    'scope',
    'idempotencyKey',
    'idempotency_key',
    'durationMinutes',
    'duration_minutes',
    'expiresAt',
    'expires_at',
    'from',
    'to',
    'limit',
    'cursor',
])

export function auditFilterQuery(filters: Record<string, unknown>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue
        params.set(key, String(value))
    }
    return `/api/admin/audit-events?${params.toString()}`
}

export function uniqueTimelineValues(values: unknown[]) {
    return Array.from(new Set(values.map(value => text(value)).filter(Boolean))).slice(0, 50)
}

export function supportInspectionRequestIds(request: string, timeline: Array<Record<string, any>>) {
    return uniqueTimelineValues([request, ...timeline.map(event => event.requestId)])
}
