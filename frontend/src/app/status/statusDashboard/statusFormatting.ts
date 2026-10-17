import type { ServiceStatus } from '@/utils/status/getStatus'

export const UPTIME_DAYS = 90
export const UPTIME_WINDOW = `${UPTIME_DAYS} days`
export const INCIDENT_WINDOW = UPTIME_WINDOW

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })
const dateTimeFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
const incidentDateTimeFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export function relativeTime(value: string, now: number | null) {
    if (!now) return 'recently'
    const timestamp = new Date(value).getTime()
    if (!Number.isFinite(timestamp)) return 'unavailable'
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    return `${dateTimeFormatter.format(new Date(value))} UTC`
}

export function formatUptime(value: string) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? `${value}%` : value || 'unverified'
}

export function barClass(status: ServiceStatus['checks'][number]['status']) {
    if (status === 'unknown') return 'bg-ui-muted'
    if (status === 'down') return 'bg-ui-danger hover:ring-2 hover:ring-ui-danger/40'
    if (status === 'degraded') return 'bg-ui-warning hover:ring-2 hover:ring-ui-warning/40'
    return 'bg-ui-success'
}

export function statusPillClass(status: ServiceStatus['checks'][number]['status']) {
    if (status === 'up') return 'bg-ui-success text-ui-on-primary'
    if (status === 'degraded') return 'bg-ui-warning/10 text-ui-warning'
    return status === 'unknown' ? 'bg-ui-raised text-ui-muted' : 'border border-ui-danger/40 bg-ui-raised text-ui-text'
}

export function formatDate(value: string) { return dateFormatter.format(new Date(value)) }
export function formatDateTime(value: string) { return `${dateTimeFormatter.format(new Date(value))} UTC` }
export function formatIncidentTimestamp(value: string) {
    return Number.isFinite(Date.parse(value)) ? `${incidentDateTimeFormatter.format(new Date(value))} UTC` : 'Not recorded'
}
