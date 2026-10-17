export { shortTime as shortDate } from '../dashboardPresentation'
import type { StatusTone } from '../dashboardPresentation'

export function runStatusTone(status: string): StatusTone {
    if (status === 'completed') return 'ok'
    if (status === 'failed') return 'bad'
    return 'neutral'
}

export function durationLabel(startedAt: string, finishedAt?: string) {
    if (!finishedAt) return 'running'
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    if (!Number.isFinite(ms) || ms < 0) return 'running'
    const seconds = Math.max(1, Math.round(ms / 1000))
    if (seconds < 60) return `${seconds}s`
    return `${Math.round(seconds / 60)}m`
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
