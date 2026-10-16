import type { WorkbenchCase, WorkbenchOrgContext } from '../types'

export function suggestedWatchTerm(item: WorkbenchCase) {
    return [item.matchedTerm, item.company, item.evidence[0]?.metadata?.find(meta => meta.label.toLowerCase().includes('domain'))?.value]
        .map(value => String(value || '').trim())
        .find(value => value && value.toLowerCase() !== 'none') || ''
}

export function inferTermKind(value: string) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return 'domain'
    if (value.includes('@')) return 'email'
    return 'company'
}

export function watchlistCoverage(orgContext: WorkbenchOrgContext | undefined, term: string) {
    const normalized = term.trim().toLowerCase()
    if (!normalized) return undefined
    for (const watchlist of orgContext?.watchlists || []) {
        const match = (watchlist.terms || []).find(candidate => String(candidate.value || '').trim().toLowerCase() === normalized)
        if (match) return { covered: true, watchlistId: watchlist.id, watchlistName: watchlist.name }
    }
    return { covered: false }
}

export function mapDwmDecision(status: string, currentStatus: string) {
    if (status === 'reviewing') return { reviewState: 'reviewing', deliveryState: 'pending_review' }
    if (status === 'escalated') return { reviewState: 'route_to_customer', deliveryState: 'ready_to_send' }
    if (status === 'suppressed') return { reviewState: 'false_positive', deliveryState: 'muted' }
    if (status === 'closed') return { reviewState: 'resolved', deliveryState: currentStatus === 'delivered' ? 'delivered' : 'muted' }
    return { reviewState: 'needs_review', deliveryState: 'pending_review' }
}
