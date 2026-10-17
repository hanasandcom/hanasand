import type { HelpdeskAuditEvent, AuditSearchParams } from './audit'
import { param } from './audit'
export { formatLocalDateTime as formatAuditTime } from '@/utils/date/formatLocalDateTime'

export const auditFieldClass = 'h-9 min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
export const auditSelectClass = `${auditFieldClass} appearance-none`
export const auditQuietButtonClass = 'grid h-9 place-items-center rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel'
export const auditSeverities = ['', 'info', 'notice', 'warning', 'critical']
export const auditOutcomes = ['', 'success', 'denied', 'failed']
export const auditLimits = ['50', '100', '200', '500']

export function auditDisplayText(value: string, kind = 'account') {
    return value.replace(/\b(?:Hanasand )?Commercial Acceptance\b/gi, kind === 'organization' ? 'Test organization' : 'Test account')
}

export function auditTargetName(event: HelpdeskAuditEvent) {
    const organizationName = event.object_type === 'organization'
        ? ((!event.organization_id || event.organization_id === event.object_id) ? event.organization_name : '')
            || (typeof event.context?.name === 'string' ? event.context.name : '')
        : ''
    const name = (typeof event.context?.targetName === 'string' ? event.context.targetName : '') || event.target_name || organizationName
    return name ? auditDisplayText(name, event.object_type || undefined)
        : event.object_id || (typeof event.context?.targetId === 'string' ? event.context.targetId : '')
            || (event.object_type === 'user' ? 'Unknown user' : event.object_type || '')
}

export function severityClass(severity: HelpdeskAuditEvent['severity']) {
    if (severity === 'critical') return 'border-ui-danger/35 bg-ui-raised/10 text-ui-text'
    if (severity === 'warning') return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
    if (severity === 'notice') return 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary'
    return 'border-ui-border bg-ui-raised text-ui-muted'
}

export function outcomeClass(outcome: HelpdeskAuditEvent['outcome']) {
    if (outcome === 'success') return 'border-ui-success/35 bg-ui-success/10 text-ui-success'
    if (outcome === 'denied') return 'border-ui-danger/35 bg-ui-raised/10 text-ui-text'
    return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
}

export function activeFilterEntries(params: AuditSearchParams) {
    return (['q', 'org', 'actor', 'target', 'action', 'severity', 'source', 'service', 'entity', 'request', 'outcome', 'from', 'to'] as const)
        .map(key => [key, param(params, key).trim()] as const)
        .filter(([, value]) => value)
}

export function selectedAuditEvent(events: HelpdeskAuditEvent[], params: AuditSearchParams) {
    const eventId = param(params, 'event').trim()
    if (eventId) return events.find(event => String(event.id) === eventId) || events[0]
    const request = param(params, 'request').trim()
    const entity = param(params, 'entity').trim()
    const action = param(params, 'action').trim()
    const target = param(params, 'target').trim()
    return events.find(event => (
        (request && event.request_id === request)
        || (entity && event.subject_id === entity)
        || (action && event.event_type === action)
        || (target && (event.object_id === target || event.target_name === target))
    )) || events[0]
}

export function auditDetailRows(event: HelpdeskAuditEvent) {
    return [
        ['Actor', event.actor_name ? auditDisplayText(event.actor_name) : event.actor_id],
        ['Target', auditTargetName(event)],
        ['Organization', event.object_type === 'organization' && event.object_id === event.organization_id
            ? undefined
            : event.organization_name ? auditDisplayText(event.organization_name, 'organization') : event.organization_id],
        ['Target source', typeof event.context?.targetSource === 'string' ? event.context.targetSource : undefined],
        ['Request', event.request_id], ['Entity', event.subject_id], ['Source', `${event.source}/${event.service}`],
    ].filter(([, value]) => value)
}
