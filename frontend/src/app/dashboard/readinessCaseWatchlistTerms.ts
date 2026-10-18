import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import type { ReadinessCaseContext } from './readinessCaseContext'
import { readinessCase } from './readinessCaseFactory'
import { watchlistCoverageHref, watchlistsHref } from './readinessCaseLinks'
import { rebuildAlertsAction } from './readinessActionDescriptors'

export function buildWatchlistTermsCase(context: ReadinessCaseContext): WorkbenchCase {
    const { input, now, organization, activeWatchlists, watchlistTerms, path } = context
    return readinessCase({
        id: 'watchlist_terms',
        kind: 'watchlist_readiness',
        queue: 'Shared watchlists',
        title: activeWatchlists.length ? 'Shared watchlist active' : 'Create shared watchlist',
        severity: activeWatchlists.length ? 'medium' : 'high',
        status: activeWatchlists.length ? 'active' : 'missing_watchlist',
        priority: activeWatchlists.length ? 260 : 380,
        confidence: input.backendConfigured ? 92 : 65,
        subtitle: activeWatchlists.length
            ? `${activeWatchlists.length} active watchlist${activeWatchlists.length === 1 ? '' : 's'} with ${watchlistTerms.length} total term${watchlistTerms.length === 1 ? '' : 's'} routed to ${input.scope.organizationId ? 'organization' : 'tenant'} alerts.`
            : input.backendConfigured ? 'Active DWM watchlist state is loading for the selected workspace.' : 'Watchlist state is syncing to collection.',
        recommendedAction: activeWatchlists.length ? 'Review term coverage, then rebuild alerts for the selected organization.' : 'Create a DWM watchlist with company, domain, vendor, brand, VIP, or product terms, then rebuild alerts.',
        evidence: [{
            id: 'ev_watchlist_route',
            sourceName: 'DWM watchlists',
            sourceFamily: 'watchlist workflow',
            captureMode: 'operator view',
            redactionState: 'customer safe',
            contentHash: activeWatchlists[0]?.id || '/api/findings/watchlists',
            excerpt: activeWatchlists.length ? activeWatchlists.map(item => `${item.id}: ${item.name}; ${(item.terms || []).map(term => term.value).join(', ')}`).join(' | ') : 'Create a watchlist with organization, terms, and optional delivery route.',
            observedAt: activeWatchlists[0]?.updatedAt || now,
            provenance: 'DWM watchlists',
            confidence: input.backendConfigured ? 92 : 65,
        }],
        timeline: [{ id: 'watchlist_state_at', at: activeWatchlists[0]?.updatedAt || now, title: activeWatchlists.length ? 'Watchlist lane active' : 'Watchlist lane checking', body: activeWatchlists.length ? 'Watchlist terms are active in DWM.' : 'Alert rebuild is held until watchlist terms attach.' }],
        nextTasks: activeWatchlists.length ? [`Owner: operator. Watchlist IDs: ${activeWatchlists.map(item => item.id).join(', ')}.`, `Terms: ${watchlistTerms.length}. Rebuild alerts for ${input.scope.organizationId || input.scope.tenantId}.`, 'Open generated DWM alerts as analyst cases before delivery.'] : ['Owner: operator. Open DWM console and save watchlist terms.', 'Run alert rebuild.', 'Confirm the watchlist has an organization owner.'],
        relatedLinks: [{ href: '/findings', label: 'Edit watchlist' }, { href: watchlistCoverageHref(input.scope, organization), label: 'Watchlist coverage' }, { href: watchlistsHref(input.scope), label: 'Watchlists API' }],
        workflowPath: path,
        actions: [
            {
                id: 'inspect_watchlist_coverage',
                label: 'Inspect coverage',
                method: 'GET',
                href: watchlistCoverageHref(input.scope, organization),
            },
            ...(activeWatchlists.length ? [rebuildAlertsAction(input.scope)] : []),
        ],
    })
}
