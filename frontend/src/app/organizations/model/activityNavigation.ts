import type { OrgBundle } from '../types/bundle'
import type { ActivitySubject, ActivitySubjectType, ActivityItem } from '../types/activity'
import type { DeliveryRow } from '../types/delivery'
import { deliveryDestinationIds, deliveryWatchlistId } from './deliveries'
import { watchlistsWithOwnDestination } from './watchlists'

export function requestedSubjectFromSearch(input: {
    organizationId: string
    focus: string
    inviteId: string
    memberId: string
    watchlistId: string
    destinationId: string
    deliveryId: string
    alertId: string
    caseId: string
}, bundle: OrgBundle): ActivitySubject {
    const delivery = requestedDeliveryFromSearch(bundle.deliveries, input.deliveryId)
    if (delivery) {
        const deliveryDestinationId = deliveryDestinationIds(delivery, bundle.webhooks)[0]
        if (deliveryDestinationId && bundle.webhooks.some(item => item.id === deliveryDestinationId)) return { type: 'destination', id: deliveryDestinationId }
        const deliveryCaseId = delivery.caseId
        if (deliveryCaseId && bundle.cases.some(item => item.id === deliveryCaseId)) return { type: 'case', id: deliveryCaseId }
        const deliveryAlertId = delivery.alertId
        if (deliveryAlertId && bundle.alerts.some(item => item.id === deliveryAlertId)) return { type: 'alert', id: deliveryAlertId }
        const requestedDeliveryWatchlistId = deliveryWatchlistId(delivery)
        if (requestedDeliveryWatchlistId && bundle.watchlists.some(item => item.id === requestedDeliveryWatchlistId)) return { type: 'watchlist', id: requestedDeliveryWatchlistId }
    }
    if (input.caseId && bundle.cases.some(item => item.id === input.caseId)) return { type: 'case', id: input.caseId }
    if (input.alertId && bundle.alerts.some(item => item.id === input.alertId)) return { type: 'alert', id: input.alertId }
    if (input.inviteId && bundle.invites.some(item => item.id === input.inviteId)) return { type: 'invite', id: input.inviteId }
    if (input.memberId && bundle.members.some(item => item.userId === input.memberId)) return { type: 'member', id: input.memberId }
    if (input.destinationId && bundle.webhooks.some(item => item.id === input.destinationId)) return { type: 'destination', id: input.destinationId }
    if (input.watchlistId && bundle.watchlists.some(item => item.id === input.watchlistId)) return { type: 'watchlist', id: input.watchlistId }
    if (input.focus === 'invites' && bundle.invites[0]?.id) return { type: 'invite', id: bundle.invites[0].id }
    if (input.focus === 'members' && bundle.members[0]?.userId) return { type: 'member', id: bundle.members[0].userId }
    if (input.focus === 'cases' && bundle.cases[0]?.id) return { type: 'case', id: bundle.cases[0].id }
    if ((input.focus === 'alerts' || input.focus === 'events') && bundle.alerts[0]?.id) return { type: 'alert', id: bundle.alerts[0].id }
    if ((input.focus === 'destinations' || input.focus === 'webhooks') && bundle.webhooks[0]?.id) return { type: 'destination', id: bundle.webhooks[0].id }
    if (input.focus === 'destinations' || input.focus === 'webhooks') {
        const watchlistRoute = watchlistsWithOwnDestination(bundle.watchlists, bundle.webhooks)[0]
        if (watchlistRoute) return { type: 'watchlist', id: watchlistRoute.id }
    }
    if (input.focus === 'watchlists' && bundle.watchlists[0]?.id) return { type: 'watchlist', id: bundle.watchlists[0].id }
    return { type: 'organization', id: input.organizationId }
}

export function requestedDeliveryFromSearch(deliveries: DeliveryRow[], deliveryId: string) {
    if (!deliveryId) return undefined
    return deliveries.find(delivery => delivery.id === deliveryId
        || delivery.requestId === deliveryId
        || delivery.auditEventId === deliveryId
        || delivery.dedupeKey === deliveryId)
}

export function focusForSubjectType(type: ActivitySubjectType) {
    if (type === 'invite') return 'invites'
    if (type === 'member') return 'members'
    if (type === 'watchlist') return 'watchlists'
    if (type === 'destination') return 'destinations'
    if (type === 'alert') return 'alerts'
    if (type === 'case') return 'cases'
    return ''
}

export function currentOrganizationFocus() {
    if (typeof window === 'undefined') return ''
    return new URL(window.location.href).searchParams.get('focus') || ''
}

export function replaceOrganizationWorkspaceSelectionUrl(organizationId: string, subject: ActivitySubject) {
    const href = organizationWorkspaceSelectionHref(organizationId, subject)
    if (!href) return
    const url = new URL(href)
    window.history.replaceState(window.history.state, '', cleanWorkspaceUrl(url.toString()))
}

export function organizationWorkspaceSelectionHref(organizationId: string, subject: ActivitySubject) {
    if (typeof window === 'undefined' || !organizationId) return ''
    const url = new URL(window.location.href)
    url.searchParams.set('org', organizationId)
    for (const key of ['inviteId', 'memberId', 'watchlistId', 'watchlistItemId', 'destinationId', 'deliveryId', 'alertId', 'alert', 'caseId']) {
        url.searchParams.delete(key)
    }
    if (subject.type === 'invite') {
        url.searchParams.set('focus', 'invites')
        url.searchParams.set('inviteId', subject.id)
    } else if (subject.type === 'member') {
        url.searchParams.set('focus', 'members')
        url.searchParams.set('memberId', subject.id)
    } else if (subject.type === 'watchlist') {
        url.searchParams.set('focus', 'watchlists')
        url.searchParams.set('watchlistId', subject.id)
    } else if (subject.type === 'destination') {
        url.searchParams.set('focus', 'destinations')
        url.searchParams.set('destinationId', subject.id)
    } else if (subject.type === 'alert') {
        url.searchParams.set('focus', 'events')
        url.searchParams.set('alertId', subject.id)
    } else if (subject.type === 'case') {
        url.searchParams.set('focus', 'cases')
        url.searchParams.set('caseId', subject.id)
    } else {
        url.searchParams.delete('focus')
    }
    return url.href
}

export function activitySubjectFromRowKey(rowKey: string | undefined, organizationId: string | undefined): ActivitySubject | null {
    if (!rowKey) return organizationId ? { type: 'organization', id: organizationId } : null
    if (rowKey === 'invite-create' || rowKey === 'watchlist-create' || rowKey === 'destination-create') return organizationId ? { type: 'organization', id: organizationId } : null
    if (rowKey.startsWith('invite-')) return { type: 'invite', id: rowKey.replace(/^invite-/, '') }
    if (rowKey.startsWith('member-')) return { type: 'member', id: rowKey.replace(/^member-/, '') }
    if (rowKey.startsWith('watchlist-')) return { type: 'watchlist', id: rowKey.replace(/^watchlist-/, '') }
    if (rowKey.startsWith('destination-')) return { type: 'destination', id: rowKey.replace(/^destination-/, '') }
    return organizationId ? { type: 'organization', id: organizationId } : null
}

export function activitySubjectFromItem(item: ActivityItem, organizationId: string): ActivitySubject {
    if (item.subjectType && item.subjectId) return { type: item.subjectType, id: item.subjectId }
    return activitySubjectFromRowKey(item.id, organizationId) || { type: 'organization', id: organizationId }
}

export function activityItemSubject(subject: ActivitySubject | null) {
    return subject ? { subjectType: subject.type, subjectId: subject.id } : {}
}

export function activityRowsForSubject(activity: ActivityItem[], subject: ActivitySubject) {
    if (subject.type === 'organization') return activity
    if (subject.type === 'destination') {
        return activity.filter(item => (item.subjectType === 'destination' || item.subjectType === 'watchlist') && (item.subjectId === subject.id || item.relatedSubjectIds?.includes(subject.id)))
    }
    return activity.filter(item => item.subjectId === subject.id || item.relatedSubjectIds?.includes(subject.id))
}
