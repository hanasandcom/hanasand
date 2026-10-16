import { formatOsloShortDateTime } from '@/utils/date/formatOsloShortDateTime'

export function statusClass(status: string) {
    const base = 'inline-flex w-fit self-start whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold capitalize leading-5'
    if (status === 'completed') return `${base} border-ui-success/35 bg-ui-success/10 text-ui-success`
    if (status === 'failed') return `${base} border-ui-danger/35 bg-ui-raised/10 text-ui-text`
    return `${base} border-ui-border bg-ui-panel text-ui-primary`
}

export function durationLabel(startedAt: string, finishedAt?: string) {
    if (!finishedAt) return 'running'
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    if (!Number.isFinite(ms) || ms < 0) return 'running'
    const seconds = Math.max(1, Math.round(ms / 1000))
    if (seconds < 60) return `${seconds}s`
    return `${Math.round(seconds / 60)}m`
}

export function shortDate(value: string) {
    return formatOsloShortDateTime(value)
}

export function relativeUntil(value: string) {
    const diff = new Date(value).getTime() - Date.now()
    if (!Number.isFinite(diff)) return 'selecting'
    const minutes = Math.round(diff / 60000)
    if (minutes < -60) return `${Math.abs(Math.round(minutes / 60))} hrs overdue`
    if (minutes < 0) return `${Math.abs(minutes)} min overdue`
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}

export function isOverdue(value: string) {
    return new Date(value).getTime() < Date.now()
}
