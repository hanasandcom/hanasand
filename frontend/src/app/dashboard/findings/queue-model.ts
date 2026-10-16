import { safeAlertSummary } from '@/utils/dwm/display'
import type { PortalAlert } from './types'
import type { QueueFilter } from './view-types'
import { stateWeight } from './queue-ranking'

export const queueFilters: Array<{ id: QueueFilter, label: string }> = [
    { id: 'active', label: 'Active' }, { id: 'ready', label: 'Ready' }, { id: 'critical', label: 'Critical' },
    { id: 'source', label: 'Source' }, { id: 'high_confidence', label: 'Strong' }, { id: 'fresh', label: 'Fresh' },
    { id: 'pending_delivery', label: 'To send' }, { id: 'reviewing', label: 'Reviewing' }, { id: 'delivered', label: 'Delivered' },
    { id: 'muted', label: 'Muted' }, { id: 'all', label: 'All' },
]

export function normalizeQueueFilter(value: string | null): QueueFilter {
    return queueFilters.some(filter => filter.id === value) ? value as QueueFilter : 'active'
}

export function orderAlerts(alerts: PortalAlert[]) {
    const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
    return [...alerts].sort((a, b) => stateWeight(b) - stateWeight(a)
        || (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0)
        || String(b.firstSeenAt).localeCompare(String(a.firstSeenAt)))
}

export function filterAlerts(alerts: PortalAlert[], filter: QueueFilter, query: string) {
    const normalizedQuery = query.trim().toLowerCase()
    return alerts.filter(alert => {
        const filterMatch = filter === 'all'
            || (filter === 'active' && alert.deliveryState !== 'muted' && alert.reviewState !== 'resolved')
            || (filter === 'ready' && alert.deliveryState === 'ready_to_send')
            || (filter === 'critical' && alert.severity === 'critical')
            || (filter === 'source' && ['telegram_public', 'darkweb_metadata'].includes(alert.sourceFamily))
            || (filter === 'high_confidence' && alert.confidence >= 80)
            || (filter === 'fresh' && isFreshAlert(alert))
            || (filter === 'pending_delivery' && ['ready_to_send', 'pending_review'].includes(alert.deliveryState || 'pending_review'))
            || (filter === 'reviewing' && alert.reviewState === 'reviewing')
            || (filter === 'delivered' && (alert.deliveryState === 'delivered' || Boolean(alert.deliveredAt)))
            || (filter === 'muted' && (alert.deliveryState === 'muted' || alert.reviewState === 'false_positive'))
        if (!filterMatch) return false
        if (!normalizedQuery) return true
        const haystack = [alert.company, alert.actor, alert.matchedTerm.value, alert.matchedTerm.kind, alert.sourceFamily,
            alert.artifactType, alert.severity, alert.reviewState, alert.deliveryState, alert.routingContext?.queue,
            alert.routingContext?.urgency, safeAlertSummary(alert)].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(normalizedQuery)
    })
}

function isFreshAlert(alert: PortalAlert) {
    if (alert.matchTiming?.kind === 'historical_backfill' || alert.matchTiming?.kind === 'unknown') return false
    const timestamp = new Date(alert.lastSeenAt || alert.evidenceSummary?.lastObservedAt || alert.firstSeenAt).getTime()
    return !Number.isNaN(timestamp) && Date.now() - timestamp < 1000 * 60 * 60 * 24 * 7
}
