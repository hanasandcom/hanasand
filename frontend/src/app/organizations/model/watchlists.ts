import type { WatchlistItem, WatchlistKind, AlertTerm } from '../types/watchlists'
import type { WebhookDestination, DeliveryRow } from '../types/delivery'
import type { OrgBundle } from '../types/bundle'
import type { OrganizationSummary } from '../types/organization'
import type { ScopedAlert } from '../types/activity'
import { deliveryTime } from './deliveries'

export function watchlistStatusCounts(watchlists: WatchlistItem[]) {
    const counts = { active: 0, paused: 0, archived: 0 }
    for (const item of watchlists) {
        const status = item.status.toLowerCase()
        if (status === 'active') counts.active++
        else if (status === 'paused') counts.paused++
        else if (status === 'archived') counts.archived++
    }
    return counts
}

export function destinationConfigured(item: WatchlistItem) {
    return Boolean(item.webhookUrlConfigured || item.webhookDestinationId || item.webhookEndpointHash || item.webhookEndpointHint)
}

export function destinationForWatchlist(item: WatchlistItem, destinations: WebhookDestination[]) {
    return destinations.find(destination => destination.id === item.webhookDestinationId
        || (destination.endpointHash && item.webhookEndpointHash === destination.endpointHash)
        || (destination.endpointHint && item.webhookEndpointHint === destination.endpointHint))
}

export function organizationDestinationConfigured(destination: WebhookDestination) {
    return Boolean(destination.deliveryReady || ['active', 'configured'].includes((destination.status || '').toLowerCase()) || destination.endpointHash || destination.endpointHint)
}

export function watchlistsWithOwnDestination(watchlists: WatchlistItem[], destinations: WebhookDestination[]) {
    return watchlists.filter(item => destinationConfigured(item) && !destinationForWatchlist(item, destinations))
}

export function organizationConfiguredDestinationCount(bundle: OrgBundle) {
    const savedDestinations = bundle.webhooks.filter(organizationDestinationConfigured).length
    return savedDestinations + watchlistsWithOwnDestination(bundle.watchlists, bundle.webhooks).length
}

export function isDuplicateWatchlistTerm(watchlists: WatchlistItem[], kind: WatchlistKind, value: string, excludeId = '') {
    const normalizedValue = normalizeWatchlistValue(value)
    if (!normalizedValue) return false
    return watchlists.some(item => item.id !== excludeId && item.status.toLowerCase() !== 'archived' && item.kind === kind && normalizeWatchlistValue(item.value) === normalizedValue)
}

export function activeTermForWatchlist(item: WatchlistItem, activeTerms: AlertTerm[]) {
    return activeTerms.find(term => (term.status || 'active').toLowerCase() === 'active'
        && (term.watchlistItemId === item.id
            || term.watchlistId === item.id
            || (Boolean(item.alertGenerationRef) && term.alertGenerationRef === item.alertGenerationRef)
            || (term.kind === item.kind && normalizeWatchlistValue(term.term || term.value || '') === normalizeWatchlistValue(item.value))))
}

export function watchlistDraftChanged(item: WatchlistItem, draft: { kind: WatchlistKind, value: string, notes: string }) {
    return item.kind !== draft.kind
        || normalizeWatchlistValue(item.value) !== normalizeWatchlistValue(draft.value)
        || (item.notes || '').trim() !== draft.notes.trim()
}

export function normalizeWatchlistValue(value: string) {
    return value.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/g, '').toLowerCase()
}

export function watchlistSearchText(item: WatchlistItem, organization: OrganizationSummary) {
    return [
        item.kind,
        item.value,
        item.status,
        item.notes,
        item.organizationId || organization.id,
        item.tenantId || organization.tenantId,
        item.createdBy,
        item.updatedBy,
        item.alertGenerationRef,
        item.webhookEndpointHint,
        item.webhookEndpointHash,
    ].filter(Boolean).join(' ').toLowerCase()
}

export function alertsForWatchlist(item: WatchlistItem, alerts: ScopedAlert[]) {
    return alerts.filter(alert => {
        if (alert.watchlistItemId === item.id) return true
        if (alert.watchlistItemIds?.includes(item.id)) return true
        if (alert.watchlistIds?.includes(item.id)) return true
        return false
    })
}

export function latestDeliveryForWatchlist(item: WatchlistItem, deliveries: DeliveryRow[]) {
    return deliveries
        .filter(delivery => delivery.watchlistId === item.id || delivery.watchlistItemId === item.id || delivery.watchlistItemIds?.includes(item.id) || delivery.watchlistIds?.includes(item.id))
        .sort((left, right) => deliveryTime(right) - deliveryTime(left))[0] || null
}
