import type { AutomationActionType, AutomationRow, AutomationScheduleKind, AutomationStatus } from './automationTypes.ts'

const ACTIVE_STATUSES = new Set(['active', 'paused', 'archived'])
const ACTION_TYPES = new Set(['agent_prompt', 'echo', 'mail_health_check', 'system_alert', 'organization_report'])
const NOTIFY_OPTIONS = new Set(['never', 'failure', 'always'])
export const SYSTEM_JSON_TARGETS = new Set(['system:metrics', 'system:ti-delivery', 'system:ti-collection', 'system:ti-enrichment', 'system:recovery'])

export function parseBoundedInteger(value: unknown, min: number, max: number, fallback: number) {
    const parsed = Number(value)
    return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

export function parseBoolean(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback
}
export function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

export function normalizeTargetUrl(value: string) {
    return value && !/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? `https://${value}` : value || null
}

export function parseScheduleKind(value: unknown): AutomationScheduleKind {
    return value === 'once' ? 'once' : 'interval'
}

export function parseIntervalMinutes(value: unknown, scheduleKind: AutomationScheduleKind) {
    if (scheduleKind !== 'interval') return null
    const minutes = Number(value)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 43_200) {
        throw new Error('Interval automations need 1 to 43200 minutes between runs.')
    }
    return Math.round(minutes)
}

export function parseRunAt(value: unknown, scheduleKind: AutomationScheduleKind) {
    const raw = clean(value)
    if (!raw) return scheduleKind === 'once' ? new Date(Date.now() + 60_000) : null
    const date = new Date(raw)
    if (!Number.isFinite(date.getTime())) {
        throw new Error('Run time must be a valid date.')
    }
    return date
}

export function parseStatus(value: unknown): AutomationStatus {
    const status = clean(value)
    return ACTIVE_STATUSES.has(status) ? status as AutomationStatus : 'active'
}

export function parseActionType(value: unknown): AutomationActionType {
    const actionType = clean(value)
    return ACTION_TYPES.has(actionType) ? actionType as AutomationActionType : 'agent_prompt'
}

export function parseMonitoringType(value: unknown): AutomationRow['monitoring_type'] {
    return value === 'post' || value === 'tcp' || value === 'ssh' || value === 'json' || value === 'push' ? value : 'fetch'
}

export function parseDestinations(value: unknown, fallback: string | null) {
    const destinations = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : []
    return destinations.length ? destinations : legacyNotificationDestinations(fallback)
}

export function legacyNotificationDestinations(modelName: string | null) {
    return modelName ? [modelName] : []
}

export function parseNotifyOn(value: unknown): 'never' | 'failure' | 'always' {
    const notifyOn = clean(value)
    return NOTIFY_OPTIONS.has(notifyOn) ? notifyOn as 'never' | 'failure' | 'always' : 'failure'
}

export function parseTimezone(value: unknown) {
    const timezone = clean(value) || 'UTC'
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
        return timezone
    } catch {
        throw new Error('Timezone must be a valid IANA timezone, for example Europe/Oslo.')
    }
}
