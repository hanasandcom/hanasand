import type { DeliveryItem } from './types'
export { caseDetailHref } from '../cases/caseRoutes'

export function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-ui-raised/10 px-2 py-0.5 text-xs font-semibold text-ui-text'
    if (severity === 'high') return 'rounded-full bg-ui-warning/10 px-2 py-0.5 text-xs font-semibold text-ui-warning'
    return 'rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'
}

export function deliveryClass(status: string) {
    if (status === 'delivered') return 'rounded-full bg-ui-success/10 px-2 py-0.5 text-xs font-semibold text-ui-success'
    if (status === 'failed') return 'rounded-full bg-ui-raised/10 px-2 py-0.5 text-xs font-semibold text-ui-text'
    return 'rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'
}

export function reviewStateClass(state?: string) {
    if (state === 'escalated') return 'rounded-full bg-ui-warning/10 px-2 py-0.5 text-xs font-semibold text-ui-warning'
    if (state === 'suppressed' || state === 'false_positive') return 'rounded-full bg-ui-raised/10 px-2 py-0.5 text-xs font-semibold text-ui-text'
    if (state === 'reviewed' || state === 'resolved') return 'rounded-full bg-ui-success/10 px-2 py-0.5 text-xs font-semibold text-ui-success'
    return 'rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'
}

export function stateLabel(value: string) {
    return value.replaceAll('_', ' ')
}

export function evidenceStrengthLabel(value: number) {
    if (value >= 80) return 'Strong'
    if (value >= 60) return 'Medium'
    return 'Low'
}

export function shortTime(value: string | undefined) {
    if (!value) return 'Observation date unavailable'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const parts = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo', hourCycle: 'h23' }).formatToParts(date)
    const byType = new Map(parts.map(part => [part.type, part.value]))
    return `${byType.get('month')} ${byType.get('day')}, ${byType.get('hour')}:${byType.get('minute')}`
}

export function relativeTimeLabel(value: string | undefined) {
    if (!value) return 'Observation date unavailable'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const deltaMs = Date.now() - date.getTime()
    const absMinutes = Math.round(Math.abs(deltaMs) / 60000)
    const suffix = deltaMs >= 0 ? 'ago' : 'from now'
    if (absMinutes < 1) return deltaMs >= 0 ? 'just now' : 'under 1 min from now'
    if (absMinutes < 60) return `${absMinutes} min ${suffix}`
    const absHours = Math.round(absMinutes / 60)
    if (absHours < 24) return `${absHours} hr ${suffix}`
    const absDays = Math.round(absHours / 24)
    if (absDays < 7) return `${absDays} day${absDays === 1 ? '' : 's'} ${suffix}`
    return shortTime(value)
}

export function caseDateLabel(value?: string) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function deliverySummaryLabel(rows: DeliveryItem[]) {
    if (!rows.length) return 'Not tested'
    const delivered = rows.filter(row => row.status === 'delivered' && row.dryRun !== true)
    if (delivered.length) return `${delivered.length} delivered`
    if (rows.some(row => row.status === 'dry_run')) return `${rows.filter(row => row.status === 'dry_run').length} tested`
    if (rows.some(row => row.status === 'failed')) return `${rows.filter(row => row.status === 'failed').length} failed`
    return `${rows.length} attempted`
}

export function webhookReady(label: string) {
    const normalized = label.toLowerCase()
    return normalized.includes('delivered') || normalized.includes('tested')
}

export function retryStateLabel(delivery: DeliveryItem) {
    if (delivery.status === 'failed') return delivery.errorClass ? stateLabel(delivery.errorClass) : 'review failure'
    if (delivery.status === 'skipped') return 'not eligible'
    if (delivery.status === 'dry_run') return 'test only'
    return 'no retry scheduled'
}
