import type { ActivitySubject } from '../types/activity'
import type { OrganizationSummary } from '../types/organization'
import type { OrgBundle } from '../types/bundle'
import { deliveriesForDestination, deliveryDestinationIds, deliveryTime } from './deliveries'
import { latestDeliveryForWatchlist, destinationForWatchlist } from './watchlists'

export function selectedSubjectActions(subject: ActivitySubject, organization: OrganizationSummary, bundle: OrgBundle) {
    const organizationId = encodeURIComponent(organization.id)
    const integrations = { label: 'Integrations', href: '/findings/delivery' }
    if (subject.type === 'organization') {
        return [
            { label: 'Settings', href: '/organizations/settings#settings' },
            { label: 'Retention & privacy', href: '/organizations/privacy#privacy' },
            { label: 'Members', href: '/organizations/team#members' },
            { label: 'Invites', href: '/organizations/team#invites' },
            { label: 'Watchlists', href: '/organizations/watchlists#watchlists' },
            integrations,
            { label: 'Activity', href: '/organizations/activity#audit' },
        ]
    }
    if (subject.type === 'invite') {
        const inviteId = encodeURIComponent(subject.id)
        return [
            { label: 'Invite', href: `/organizations/team#invite-${inviteId}` },
            { label: 'Audit trail', href: '/organizations/activity#audit' },
        ]
    }
    if (subject.type === 'member') {
        const memberId = encodeURIComponent(subject.id)
        return [
            { label: 'Member', href: `/organizations/team#member-${memberId}` },
            { label: 'Audit trail', href: '/organizations/activity#audit' },
        ]
    }
    if (subject.type === 'watchlist') {
        const watchlistId = encodeURIComponent(subject.id)
        return [
            { label: 'Watchlist', href: `/organizations/watchlists#watchlist-${watchlistId}` },
            integrations,
            { label: 'Open event workspace', href: `/ti/workbench?organizationId=${organizationId}&watchlistId=${watchlistId}` },
        ]
    }
    if (subject.type === 'destination') {
        const watchlistId = selectedSubjectWatchlistId(subject, bundle)
        return [
            integrations,
            ...(watchlistId ? [{ label: 'Watchlist', href: `/organizations/watchlists#watchlist-${encodeURIComponent(watchlistId)}` }] : []),
        ]
    }
    if (subject.type === 'alert') {
        const alertId = encodeURIComponent(subject.id)
        const watchlistId = selectedSubjectWatchlistId(subject, bundle)
        const destinationId = selectedSubjectDestinationId(subject, bundle)
        const deliveryId = selectedSubjectDeliveryId(subject, bundle)
        return [
            { label: 'Event', href: `/ti/workbench?alertId=${alertId}&organizationId=${organizationId}` },
            { label: 'Record', href: `/organizations/events#event-record-${alertId}` },
            ...(watchlistId ? [{ label: 'Watchlist', href: `/organizations/watchlists#watchlist-${encodeURIComponent(watchlistId)}` }] : []),
            ...(destinationId || deliveryId ? [integrations] : []),
            { label: 'Organization activity', href: '/organizations/activity#audit' },
        ]
    }
    if (subject.type === 'case') {
        const caseId = encodeURIComponent(subject.id)
        const watchlistId = selectedSubjectWatchlistId(subject, bundle)
        const destinationId = selectedSubjectDestinationId(subject, bundle)
        const deliveryId = selectedSubjectDeliveryId(subject, bundle)
        return [
            { label: 'Case', href: `/cases/${caseId}?organizationId=${organizationId}` },
            { label: 'Record', href: `/organizations/events#case-record-${caseId}` },
            ...(watchlistId ? [{ label: 'Watchlist', href: `/organizations/watchlists#watchlist-${encodeURIComponent(watchlistId)}` }] : []),
            ...(destinationId || deliveryId ? [integrations] : []),
            { label: 'Organization activity', href: '/organizations/activity#audit' },
        ]
    }
    return []
}

export function selectedSubjectWatchlistId(subject: ActivitySubject, bundle: OrgBundle) {
    if (subject.type === 'destination') {
        const destination = bundle.webhooks.find(item => item.id === subject.id)
        const watchlist = bundle.watchlists.find(item => item.webhookDestinationId === subject.id
            || (destination?.endpointHash && item.webhookEndpointHash === destination.endpointHash)
            || (destination?.endpointHint && item.webhookEndpointHint === destination.endpointHint))
        const delivery = destination ? deliveriesForDestination(destination, bundle.deliveries).find(item => item.watchlistItemId || item.watchlistId || item.watchlistItemIds?.[0] || item.watchlistIds?.[0]) : undefined
        return watchlist?.id || delivery?.watchlistItemId || delivery?.watchlistId || delivery?.watchlistItemIds?.[0] || delivery?.watchlistIds?.[0] || ''
    }
    if (subject.type === 'alert') {
        const alert = bundle.alerts.find(item => item.id === subject.id)
        const delivery = bundle.deliveries.find(item => item.alertId === subject.id && (item.watchlistItemId || item.watchlistId || item.watchlistItemIds?.[0] || item.watchlistIds?.[0]))
        return alert?.watchlistItemId || alert?.watchlistItemIds?.[0] || alert?.watchlistIds?.[0] || delivery?.watchlistItemId || delivery?.watchlistId || delivery?.watchlistItemIds?.[0] || delivery?.watchlistIds?.[0] || ''
    }
    if (subject.type === 'case') {
        const delivery = bundle.deliveries.find(item => item.caseId === subject.id && (item.watchlistItemId || item.watchlistId || item.watchlistItemIds?.[0] || item.watchlistIds?.[0]))
        return delivery?.watchlistItemId || delivery?.watchlistId || delivery?.watchlistItemIds?.[0] || delivery?.watchlistIds?.[0] || ''
    }
    return ''
}

export function selectedSubjectDestinationId(subject: ActivitySubject, bundle: OrgBundle) {
    if (subject.type === 'watchlist') {
        const item = bundle.watchlists.find(row => row.id === subject.id)
        const delivery = item ? latestDeliveryForWatchlist(item, bundle.deliveries) : undefined
        const destination = item ? destinationForWatchlist(item, bundle.webhooks) : undefined
        return destination?.id || item?.webhookDestinationId || (delivery ? deliveryDestinationIds(delivery, bundle.webhooks)[0] : '') || ''
    }
    if (subject.type === 'alert') {
        const delivery = bundle.deliveries.find(item => item.alertId === subject.id && deliveryDestinationIds(item, bundle.webhooks)[0])
        return delivery ? deliveryDestinationIds(delivery, bundle.webhooks)[0] || '' : ''
    }
    if (subject.type === 'case') {
        const delivery = bundle.deliveries.find(item => item.caseId === subject.id && deliveryDestinationIds(item, bundle.webhooks)[0])
        return delivery ? deliveryDestinationIds(delivery, bundle.webhooks)[0] || '' : ''
    }
    return ''
}

export function selectedSubjectDeliveryId(subject: ActivitySubject, bundle: OrgBundle) {
    if (subject.type === 'watchlist') {
        const item = bundle.watchlists.find(row => row.id === subject.id)
        return item ? latestDeliveryForWatchlist(item, bundle.deliveries)?.id || '' : ''
    }
    if (subject.type === 'destination') {
        const destination = bundle.webhooks.find(row => row.id === subject.id)
        return destination ? deliveriesForDestination(destination, bundle.deliveries).sort((left, right) => deliveryTime(right) - deliveryTime(left))[0]?.id || '' : ''
    }
    if (subject.type === 'alert') {
        return bundle.deliveries.filter(item => item.alertId === subject.id).sort((left, right) => deliveryTime(right) - deliveryTime(left))[0]?.id || ''
    }
    if (subject.type === 'case') {
        return bundle.deliveries.filter(item => item.caseId === subject.id).sort((left, right) => deliveryTime(right) - deliveryTime(left))[0]?.id || ''
    }
    return ''
}

export function compactMetadata(rows: Array<[string, string | undefined]>) {
    return rows
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([label, value]) => ({ label, value: String(value) }))
}
