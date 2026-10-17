import type { SystemEventInput, SystemEventOutcome, SystemEventSeverity } from './systemEvent.ts'

export type SupportTimelineAuditBridgeInput = {
    workflow: 'organization' | 'watchlist' | 'webhook' | 'alert' | 'impersonation' | 'support'
    action: string
    actorId: string
    targetType: string
    targetId: string
    organizationId?: string | null
    entityId?: string | null
    requestId?: string | null
    severity?: SystemEventSeverity
    outcome?: SystemEventOutcome
    reason?: string | null
    source?: string | null
    service?: string | null
    scope?: unknown
    before?: unknown
    after?: unknown
    context?: Record<string, unknown>
    correlationId?: string | null
    idempotencyKey?: string | null
}

const sensitiveAuditKeyPattern = /(password|token|secret|authorization|cookie|apikey|api_key|session|credential|webhook|endpoint|url|source_url|sourceurl|private_url|privateurl)/i

export function cleanAuditReason(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 1000) : ''
}

export function redactAuditValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => redactAuditValue(item))
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sensitiveAuditKeyPattern.test(key) ? '[redacted]' : redactAuditValue(item),
    ]))
}

export function supportTimelineAuditBridgeEvent(input: SupportTimelineAuditBridgeInput): SystemEventInput {
    const action = cleanAuditAction(input.action)
    const workflow = cleanAuditDimension(input.workflow) || 'support'
    const actionType = action.includes('.') ? action : `${workflow}.${action}`
    const entityId = cleanAuditId(input.entityId) || cleanAuditId(input.targetId) || cleanAuditId(input.organizationId)
    const organizationId = cleanAuditId(input.organizationId)
    const requestId = cleanAuditId(input.requestId)
    const correlationId = cleanAuditId(input.correlationId) || requestId
    const idempotencyKey = cleanAuditId(input.idempotencyKey)

    return {
        actionType,
        actorId: cleanAuditId(input.actorId),
        targetType: cleanAuditDimension(input.targetType) || workflow,
        targetId: cleanAuditId(input.targetId),
        organizationId: organizationId || null,
        entityId: entityId || null,
        requestId: requestId || null,
        severity: input.severity || 'info',
        outcome: input.outcome || 'success',
        reason: cleanAuditReason(input.reason),
        source: cleanAuditDimension(input.source) || workflow,
        service: cleanAuditDimension(input.service) || 'hanasand-api',
        context: {
            ...(input.context || {}),
            schemaVersion: 'support.audit.bridge_event.v1',
            workflow,
            action,
            actionType,
            actor: { id: cleanAuditId(input.actorId) },
            target: {
                type: cleanAuditDimension(input.targetType) || workflow,
                id: cleanAuditId(input.targetId),
            },
            organizationId: organizationId || null,
            entityId: entityId || null,
            requestId: requestId || null,
            correlationId: correlationId || null,
            idempotencyKey: idempotencyKey || null,
            scope: redactAuditValue(input.scope ?? null),
            before: redactAuditValue(input.before ?? null),
            after: redactAuditValue(input.after ?? null),
            supportTimeline: {
                schemaVersion: 'support.audit.timeline_adapter.v1',
                filters: {
                    org: organizationId || null,
                    actor: cleanAuditId(input.actorId),
                    target: cleanAuditId(input.targetId),
                    action: actionType,
                    entity: entityId || null,
                    request: requestId || null,
                    outcome: input.outcome || 'success',
                    severity: input.severity || 'info',
                    source: cleanAuditDimension(input.source) || workflow,
                    service: cleanAuditDimension(input.service) || 'hanasand-api',
                },
                detailRouteTemplate: '/api/admin/audit-events/:id',
                redactionRequired: true,
            },
            redactionRequired: true,
        },
    }
}

export function cleanAuditDimension(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, '-').slice(0, 80) : ''
}

function cleanAuditAction(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/_+/g, '_').slice(0, 120) : 'event'
}

function cleanAuditId(value: unknown) {
    return typeof value === 'string' ? value.trim().slice(0, 200) : ''
}
