import type { OrganizationSummary } from '../types/organization'
import type { WatchlistItem, WatchlistSuggestion } from '../types/watchlists'
import { normalizeOrganizationName, organizationDisplayName, firstDomainCandidate } from './organization'
import { isDuplicateWatchlistTerm } from './watchlists'

export function starterWatchlistSuggestions(organization: OrganizationSummary, watchlists: WatchlistItem[]): WatchlistSuggestion[] {
    const candidates: Array<Omit<WatchlistSuggestion, 'disabled'>> = []
    const name = normalizeOrganizationName(organizationDisplayName(organization))
    if (name && name !== 'Organization') {
        candidates.push({
            id: 'company-name',
            label: 'Company name',
            kind: 'company',
            value: name,
            notes: 'Primary organization name monitored for source mentions.',
        })
    }

    const domain = [organization.slug, organization.id, organization.name]
        .map(value => firstDomainCandidate(String(value || '')))
        .find(Boolean)
    if (domain) {
        candidates.push({
            id: 'domain',
            label: 'Domain',
            kind: 'domain',
            value: domain,
            notes: 'Organization domain monitored for exposure mentions.',
        })
    }

    return candidates
        .filter((candidate, index, list) => list.findIndex(item => item.kind === candidate.kind && item.value.toLowerCase() === candidate.value.toLowerCase()) === index)
        .map(candidate => ({
            ...candidate,
            disabled: isDuplicateWatchlistTerm(watchlists, candidate.kind, candidate.value),
        }))
}
