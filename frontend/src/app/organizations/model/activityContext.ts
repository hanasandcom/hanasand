import type { ActivitySubject } from '../types/activity'
import type { OrganizationSummary } from '../types/organization'
import type { OrgBundle } from '../types/bundle'
import { organizationDisplayName, organizationMemberLabel, organizationDisplayId, destinationDisplayState } from './organization'
import { compactReference } from './references'
import { compactMetadata } from './activityActions'
import { sanitizeOrganizationDisplayCopy } from './textSafety'
import { organizationConfiguredDestinationCount, latestDeliveryForWatchlist, alertsForWatchlist, activeTermForWatchlist } from './watchlists'
import { formatDate } from './labels'
import { matchReasonForRecord, deliveriesForDestination, deliveryTime } from './deliveries'

export function selectedSubjectLabel(subject: ActivitySubject, organization: OrganizationSummary, bundle: OrgBundle) {
    if (subject.type === 'organization') return organizationDisplayName(organization)
    if (subject.type === 'invite') {
        const invite = bundle.invites.find(item => item.id === subject.id)
        return invite?.email || compactReference(subject.id, 'invite') || 'Invite'
    }
    if (subject.type === 'member') {
        const member = bundle.members.find(item => item.userId === subject.id)
        return member?.name || member?.email || organizationMemberLabel(subject.id, bundle.members) || 'Member'
    }
    if (subject.type === 'alert') {
        const alert = bundle.alerts.find(item => item.id === subject.id)
        return alert?.title || compactReference(alert?.id || subject.id, 'event') || 'Event'
    }
    if (subject.type === 'case') {
        const item = bundle.cases.find(row => row.id === subject.id)
        return item?.title || compactReference(item?.id || subject.id, 'case') || 'Case'
    }
    const watchlist = bundle.watchlists.find(item => item.id === subject.id)
    const destination = bundle.webhooks.find(item => item.id === subject.id)
    if (destination) return destination.name || compactReference(destination.id, 'destination') || 'Destination'
    if (subject.type === 'destination') return watchlist ? `Destination · ${watchlist.value}` : compactReference(subject.id, 'destination') || 'Destination'
    return watchlist?.value || compactReference(subject.id, 'watchlist') || 'Watchlist'
}

export function selectedContextRows(subject: ActivitySubject, organization: OrganizationSummary, bundle: OrgBundle) {
    if (subject.type === 'organization') {
        const closedMemberCount = bundle.members.filter(member => ['removed', 'revoked', 'inactive'].includes(member.status.toLowerCase())).length
        return compactMetadata([
            ['Org', organizationDisplayId(organization)],
            ['Workspace', sanitizeOrganizationDisplayCopy(organization.status || organization.slug || organization.id) || 'Active workspace'],
            ['Role', organization.role || 'reader'],
            ['Members', String(bundle.members.length)],
            ['Closed access', closedMemberCount ? String(closedMemberCount) : undefined],
            ['Pending invites', String(bundle.invites.filter(invite => invite.status.toLowerCase() === 'pending').length)],
            ['Watchlists', String(bundle.watchlists.length)],
            ['Active terms', String(bundle.watchlists.filter(item => item.status.toLowerCase() === 'active').length)],
            ['Destinations', String(organizationConfiguredDestinationCount(bundle))],
        ])
    }
    if (subject.type === 'invite') {
        const invite = bundle.invites.find(item => item.id === subject.id)
        const status = invite?.status.toLowerCase()
        return compactMetadata([
            ['Email', invite?.email],
            ['Role', invite?.role],
            ['Status', invite?.status],
            ['Access', status === 'accepted' ? 'Active member' : status === 'pending' ? 'Pending invite' : status ? 'Closed' : undefined],
            ['Expires', invite?.expiresAt ? formatDate(invite.expiresAt) : undefined],
        ])
    }
    if (subject.type === 'member') {
        const member = bundle.members.find(item => item.userId === subject.id)
        const status = member?.status.toLowerCase()
        return compactMetadata([
            ['User', organizationMemberLabel(member?.userId, bundle.members)],
            ['Email', member?.email],
            ['Role', member?.role],
            ['Status', member?.status],
            ['Access', status && ['removed', 'revoked', 'inactive'].includes(status) ? 'Closed' : status ? 'Active' : undefined],
            ['Joined', member?.joinedAt ? formatDate(member.joinedAt) : undefined],
        ])
    }
    if (subject.type === 'alert') {
        const alert = bundle.alerts.find(item => item.id === subject.id)
        const matchReason = matchReasonForRecord(subject.id, bundle.deliveries)
        return compactMetadata([
            ['Event', alert?.title || compactReference(alert?.id || subject.id, 'event')],
            ['Severity', alert?.severity],
            ['Status', alert?.status],
            ['Watchlist', compactReference(alert?.watchlistItemId || alert?.watchlistItemIds?.[0] || alert?.watchlistIds?.[0], 'watchlist')],
            ['Match', matchReason],
            ['Updated', alert?.updatedAt ? formatDate(alert.updatedAt) : undefined],
        ])
    }
    if (subject.type === 'case') {
        const item = bundle.cases.find(row => row.id === subject.id)
        const matchReason = matchReasonForRecord(subject.id, bundle.deliveries)
        return compactMetadata([
            ['Case', item?.title || compactReference(item?.id || subject.id, 'case')],
            ['Status', item?.status],
            ['Owner', organizationMemberLabel(item?.assignedOwner, bundle.members)],
            ['Match', matchReason],
            ['Updated', item?.updatedAt ? formatDate(item.updatedAt) : undefined],
        ])
    }
    const destination = subject.type === 'destination' ? bundle.webhooks.find(row => row.id === subject.id) : undefined
    if (destination) {
        const delivery = deliveriesForDestination(destination, bundle.deliveries)
            .sort((left, right) => deliveryTime(right) - deliveryTime(left))[0] || null
        return compactMetadata([
            ['Name', destination.name],
            ['Type', destination.kind || destination.type || 'webhook'],
            ['Status', destination.status || (destination.deliveryReady ? 'active' : 'configured')],
            ['Destination', destinationDisplayState(destination)],
            ['Endpoint', sanitizeOrganizationDisplayCopy(destination.endpointHint) || compactReference(destination.endpointHash, 'route')],
            ['Ref', compactReference(destination.id, 'dest')],
            ['Last delivery', delivery?.status],
        ])
    }
    const item = bundle.watchlists.find(row => row.id === subject.id)
    const delivery = item ? latestDeliveryForWatchlist(item, bundle.deliveries) : null
    const alertCount = item ? alertsForWatchlist(item, bundle.alerts).length : 0
    const matchReason = item ? matchReasonForRecord(item.id, bundle.deliveries) : ''
    const activeAlertTerm = item ? activeTermForWatchlist(item, bundle.alertTerms) : undefined
    return compactMetadata([
        ['Watchlist', item?.value || compactReference(item?.id || subject.id, 'watchlist')],
        ['Term', item?.value],
        ['Status', item?.status],
        ['Event term', activeAlertTerm ? 'Active' : item?.status?.toLowerCase() === 'active' ? 'Pending' : 'Excluded'],
        ['Owner', organizationMemberLabel(item?.updatedBy || item?.createdBy, bundle.members)],
        ['Destination', item ? destinationDisplayState(item) : destinationDisplayState(delivery)],
        ['Endpoint', sanitizeOrganizationDisplayCopy(item?.webhookEndpointHint) || compactReference(item?.webhookEndpointHash, 'route')],
        ['Match', activeAlertTerm?.matchReason || matchReason],
        ['Ref', compactReference(activeAlertTerm?.alertGenerationRef || item?.alertGenerationRef || item?.id || subject.id, 'watch')],
        ['Provenance', compactReference(activeAlertTerm?.provenanceHash, 'hash')],
        ['Last delivery', delivery?.status],
        ['Events', String(alertCount)],
    ])
}
