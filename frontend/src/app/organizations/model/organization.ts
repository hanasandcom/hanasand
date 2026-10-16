import type { WebhookDestination, DeliveryRow } from '../types/delivery'
import type { WatchlistItem } from '../types/watchlists'
import type { OrganizationSummary, OrganizationMember, OrganizationInvite } from '../types/organization'
import { sanitizeOrganizationDisplayCopy } from './textSafety'
import { compactReference } from './references'

export function destinationDisplayState(input?: Pick<WebhookDestination, 'endpointHash' | 'endpointHint' | 'deliveryReady' | 'status'> | Pick<WatchlistItem, 'webhookEndpointHash' | 'webhookEndpointHint' | 'webhookUrlConfigured'> | Pick<DeliveryRow, 'endpointHash' | 'endpointHint' | 'webhookDestinationId' | 'watchlistId' | 'watchlistItemId' | 'watchlistIds' | 'watchlistItemIds'> | null) {
    if (!input) return 'Destination pending'
    if ('deliveryReady' in input && input.deliveryReady) return 'Destination configured'
    if ('webhookUrlConfigured' in input && input.webhookUrlConfigured) return 'Destination configured'
    if ('endpointHint' in input && input.endpointHint) return 'Destination configured'
    if ('endpointHash' in input && input.endpointHash) return 'Destination configured'
    if ('webhookEndpointHint' in input && input.webhookEndpointHint) return 'Destination configured'
    if ('webhookEndpointHash' in input && input.webhookEndpointHash) return 'Destination configured'
    if ('webhookDestinationId' in input && input.webhookDestinationId) return 'Saved destination'
    if ('watchlistId' in input && (input.watchlistId || input.watchlistItemId || input.watchlistIds?.[0] || input.watchlistItemIds?.[0])) return 'Saved watchlist route'
    return 'Destination pending'
}

export function organizationDisplayName(organization: Pick<OrganizationSummary, 'name' | 'slug' | 'id'> | undefined) {
    return sanitizeOrganizationDisplayCopy(organization?.name || organization?.slug || organization?.id) || 'Organization'
}

export function organizationMemberLabel(userId: string | undefined | null, members: OrganizationMember[]) {
    if (!userId) return undefined
    const member = members.find(item => item.userId === userId || item.email === userId)
    if (member) return sanitizeOrganizationDisplayCopy(member.name || member.email || member.userId)
    return compactReference(userId, 'user') || userId
}

export function organizationDisplayId(organization: Pick<OrganizationSummary, 'slug' | 'id'> | undefined) {
    return sanitizeOrganizationDisplayCopy(organization?.slug || organization?.id) || 'organization'
}

export function organizationSearchText(organization: OrganizationSummary) {
    return [
        organization.id,
        organization.slug,
        organization.name,
        organization.tenantId,
        organization.role,
        organization.status,
        organization.memberCount,
    ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase()
}

export function memberSearchText(member: OrganizationMember) {
    return [
        member.userId,
        member.email,
        member.name,
        member.role,
        member.status,
        member.invitedBy,
    ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase()
}

export function inviteSearchText(invite: OrganizationInvite) {
    return [
        invite.id,
        invite.email,
        invite.role,
        invite.status,
        invite.createdAt,
        invite.expiresAt,
        invite.acceptancePath,
        invite.acceptanceUrl,
    ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase()
}

export function normalizeOrganizationName(value: string) {
    return value.trim().replace(/\s+/g, ' ')
}

export function slugifyOrganizationName(value: string) {
    return normalizeOrganizationName(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function organizationNameInUse(organizations: OrganizationSummary[], name: string) {
    const normalizedName = normalizeOrganizationName(name).toLowerCase()
    const slug = slugifyOrganizationName(name)
    return organizations.some(organization => {
        const existingName = normalizeOrganizationName(organization.name || '').toLowerCase()
        const existingSlug = (organization.slug || '').toLowerCase()
        const existingId = (organization.id || '').toLowerCase()
        return existingName === normalizedName || existingSlug === slug || existingId === slug
    })
}

export function firstDomainCandidate(value: string) {
    const match = value.toLowerCase().match(/\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,}\b/)
    return match?.[0]
}
