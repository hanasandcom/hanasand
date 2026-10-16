import type { ActivityItem } from '../types/activity'
import type { OrgBundle } from '../types/bundle'
import { deliveryWatchlistId, deliveryDestinationIds } from './deliveries'
import { compactReference } from './references'
import { compactMetadata } from './activityActions'
import { organizationMemberLabel, destinationDisplayState } from './organization'
import { formatDate } from './labels'
import { destinationForWatchlist } from './watchlists'

export function organizationActivityRows(local: ActivityItem[], bundle: OrgBundle, organizationId?: string) {
    const localRows = organizationId ? local.filter(item => item.organizationId === organizationId) : []
    const eventRows: ActivityItem[] = bundle.alerts.map(alert => {
        const delivery = bundle.deliveries.find(item => item.alertId === alert.id)
        const watchlistId = alert.watchlistItemId || alert.watchlistItemIds?.[0] || alert.watchlistIds?.[0] || (delivery ? deliveryWatchlistId(delivery) : '')
        const destinationIds = delivery ? deliveryDestinationIds(delivery, bundle.webhooks) : []
        return {
            id: `event-${alert.id}`,
            at: alert.updatedAt || new Date(0).toISOString(),
            title: 'Event',
            detail: `${alert.title || compactReference(alert.id, 'event')} · ${alert.severity || 'severity'} · ${alert.status || 'status'}`,
            ok: alert.status?.toLowerCase() !== 'failed' && alert.status?.toLowerCase() !== 'suppressed',
            subjectType: 'alert',
            subjectId: alert.id,
            relatedSubjectIds: [watchlistId, ...destinationIds, alert.watchlistItemId, ...(alert.watchlistItemIds || []), ...(alert.watchlistIds || [])].filter(Boolean) as string[],
            metadata: compactMetadata([
                ['Event', compactReference(alert.id, 'event')],
                ['Severity', alert.severity],
                ['Status', alert.status],
                ['Watchlist', compactReference(watchlistId, 'watchlist')],
                ['Destination', compactReference(destinationIds[0], 'dest')],
            ]),
        }
    })
    const caseRows: ActivityItem[] = bundle.cases.map(item => {
        const delivery = bundle.deliveries.find(row => row.caseId === item.id)
        const watchlistId = delivery ? deliveryWatchlistId(delivery) : ''
        const destinationIds = delivery ? deliveryDestinationIds(delivery, bundle.webhooks) : []
        return {
            id: `case-${item.id}`,
            at: item.updatedAt || new Date(0).toISOString(),
            title: 'Case',
            detail: `${item.title || compactReference(item.id, 'case')} · ${item.status || 'status'}${item.assignedOwner ? ` · ${organizationMemberLabel(item.assignedOwner, bundle.members)}` : ''}`,
            ok: item.status?.toLowerCase() !== 'failed' && item.status?.toLowerCase() !== 'blocked',
            subjectType: 'case',
            subjectId: item.id,
            relatedSubjectIds: [watchlistId, ...destinationIds, delivery?.alertId, ...(delivery?.watchlistIds || [])].filter(Boolean) as string[],
            metadata: compactMetadata([
                ['Case', compactReference(item.id, 'case')],
                ['Status', item.status],
                ['Owner', organizationMemberLabel(item.assignedOwner, bundle.members)],
                ['Watchlist', compactReference(watchlistId, 'watchlist')],
                ['Destination', compactReference(destinationIds[0], 'dest')],
            ]),
        }
    })
    const deliveryRows: ActivityItem[] = bundle.deliveries.map(delivery => {
        const destinationIds = deliveryDestinationIds(delivery, bundle.webhooks)
        const watchlistId = deliveryWatchlistId(delivery)
        return {
            id: `delivery-${delivery.id}`,
            at: delivery.attemptedAt || delivery.updatedAt || delivery.createdAt || new Date(0).toISOString(),
            title: delivery.dryRun ? 'Destination tested' : 'Event delivery recorded',
            detail: `${delivery.status || 'delivery'} · ${compactReference(watchlistId || delivery.alertId, 'watchlist') || 'Watchlist pending'}`,
            ok: !delivery.error && delivery.status?.toLowerCase() !== 'failed',
            subjectType: destinationIds[0] ? 'destination' : watchlistId ? 'watchlist' : 'alert',
            subjectId: destinationIds[0] || watchlistId || delivery.alertId,
            relatedSubjectIds: [
                ...destinationIds,
                delivery.watchlistItemId,
                delivery.watchlistId,
                delivery.alertId,
                delivery.caseId,
                delivery.actionId,
                ...(delivery.watchlistItemIds || []),
                ...(delivery.watchlistIds || []),
            ].filter(Boolean) as string[],
            metadata: compactMetadata([
                ['Destination', destinationDisplayState(delivery)],
                ['Saved route', destinationIds.length || watchlistId ? 'Available' : undefined],
                ['Event', compactReference(delivery.alertId, 'event')],
                ['Case', compactReference(delivery.caseId, 'case')],
                ['Watchlist', compactReference(watchlistId, 'watchlist')],
                ['Kind', delivery.deliveryKind],
            ]),
        }
    })
    const inviteRows: ActivityItem[] = bundle.invites.map(invite => ({
        id: `invite-${invite.id}`,
        at: invite.createdAt || new Date(0).toISOString(),
        title: 'Invite',
        detail: `${invite.email} · ${invite.role} · ${invite.status}`,
        ok: invite.status.toLowerCase() !== 'revoked' && invite.status.toLowerCase() !== 'expired',
        subjectType: 'invite',
        subjectId: invite.id,
        metadata: compactMetadata([
            ['Email', invite.email],
            ['Expires', invite.expiresAt ? formatDate(invite.expiresAt) : undefined],
        ]),
    }))
    const memberRows: ActivityItem[] = bundle.members.map(member => ({
        id: `member-${member.userId}`,
        at: member.joinedAt || new Date(0).toISOString(),
        title: 'Member role',
        detail: `${organizationMemberLabel(member.userId, bundle.members)} · ${member.role} · ${member.status}`,
        ok: member.status.toLowerCase() !== 'removed' && member.status.toLowerCase() !== 'revoked',
        subjectType: 'member',
        subjectId: member.userId,
        metadata: compactMetadata([
            ['User', organizationMemberLabel(member.userId, bundle.members)],
            ['Email', member.email],
            ['Invited by', member.invitedBy || undefined],
        ]),
    }))
    const watchlistRows: ActivityItem[] = bundle.watchlists.map(item => {
        const destination = destinationForWatchlist(item, bundle.webhooks)
        return {
            id: `watchlist-${item.id}`,
            at: item.updatedAt || item.archivedAt || item.createdAt || new Date(0).toISOString(),
            title: 'Watchlist term',
            detail: `${item.kind} · ${item.value} · ${item.status}`,
            ok: item.status.toLowerCase() !== 'archived',
            subjectType: 'watchlist',
            subjectId: item.id,
            relatedSubjectIds: [destination?.id, item.webhookDestinationId, item.alertGenerationRef].filter(Boolean) as string[],
            metadata: compactMetadata([
                ['Owner', organizationMemberLabel(item.updatedBy || item.createdBy, bundle.members)],
                ['Destination', destinationDisplayState(destination || item)],
                ['Ref', compactReference(item.alertGenerationRef || item.id, 'ref')],
            ]),
        }
    })
    const destinationRows: ActivityItem[] = bundle.webhooks.map(destination => ({
        id: `destination-${destination.id}`,
        at: destination.updatedAt || destination.createdAt || new Date(0).toISOString(),
        title: 'Destination',
        detail: `${destination.status || (destination.deliveryReady ? 'active' : 'configured')} · ${destinationDisplayState(destination)}`,
        ok: destination.status !== 'disabled' && destination.status !== 'deleted',
        subjectType: 'destination',
        subjectId: destination.id,
        metadata: compactMetadata([
            ['Type', destination.kind || destination.type],
            ['Destination', destinationDisplayState(destination)],
            ['Ref', compactReference(destination.id, 'dest')],
        ]),
    }))
    return [...localRows, ...eventRows, ...caseRows, ...deliveryRows, ...inviteRows, ...memberRows, ...watchlistRows, ...destinationRows]
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
}
