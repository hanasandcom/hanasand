import type { OperatorActionRailRow, WorkbenchCase, WorkbenchOrgContext } from '../../types'

export function readinessRows(selected: WorkbenchCase, orgContext?: WorkbenchOrgContext): OperatorActionRailRow[] {
    const rows: OperatorActionRailRow[] = []
    const sourceCoverage = orgContext?.readiness.sourceCoverage
    if (sourceCoverage) {
        rows.push({
            id: 'source_health',
            label: 'Source health',
            detail: `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active sources; ${sourceCoverage.watchlistMatchCount} watchlist matches.`,
            tone: sourceCoverage.activeSourceCount ? 'ready' : 'needs_action',
            href: '/ti/sources',
        })
    } else {
        rows.push({ id: 'source_unavailable', label: 'Source health', detail: 'Open collection to refresh live source coverage.', tone: 'needs_action', href: '/ti/sources' })
    }
    if (selected.kind === 'org_readiness') {
        if (orgContext?.organization) {
            rows.push({
                id: 'inspect_org_members',
                label: 'Inspect members',
                detail: `${orgContext.readiness.activeMemberCount} active member${orgContext.readiness.activeMemberCount === 1 ? '' : 's'} available for assignment and visibility checks.`,
                tone: orgContext.members.some(member => member.status === 'active') ? 'ready' : 'needs_action',
                href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/members`,
            })
            rows.push({
                id: 'inspect_org_alert_readiness',
                label: 'Alert status',
                detail: 'Shared watchlist alertability is attached for this organization.',
                tone: orgContext.readiness.activeWatchlistCount ? 'ready' : 'needs_action',
                href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/alert-readiness`,
            })
        } else {
            rows.push({ id: 'create_org_context', label: 'Open organizations', detail: 'Create or select an organization before live customer routing.', tone: 'needs_action', href: '/api/organizations' })
        }
    }
    if (selected.kind === 'watchlist_readiness') {
        rows.push({
            id: 'open_watchlist_workflow',
            label: 'Edit watched terms',
            detail: 'Open dark web cases to create shared terms, attach delivery, and rebuild generated alerts.',
            tone: 'ready',
            href: '/findings',
        })
        rows.push({
            id: 'inspect_watchlists',
            label: 'Inspect watchlists',
            detail: 'Shared watchlist terms and delivery routing feed alert generation.',
            tone: orgContext?.readiness.activeWatchlistCount ? 'ready' : 'needs_action',
            href: '/api/findings/watchlists',
        })
        rows.push({
            id: 'inspect_watchlist_alert_queue',
            label: 'Generated alerts',
            detail: 'Persisted alerts generated from shared watchlists and source coverage.',
            tone: orgContext?.readiness.liveAlertCount ? 'ready' : 'needs_action',
            href: '/api/findings/alerts',
        })
        if (orgContext?.organization) {
            rows.push({
                id: 'inspect_watchlist_alertability',
                label: 'Alertability status',
                detail: 'Active watchlist terms and visibility status are attached.',
                tone: orgContext.readiness.activeWatchlistCount ? 'ready' : 'needs_action',
                href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/alert-readiness`,
            })
        }
    }
    if (selected.kind === 'source_readiness') {
        rows.push({
            id: 'inspect_dwm_operations',
            label: 'Source coverage',
            detail: sourceCoverage
                ? `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active sources, ${sourceCoverage.captureCount} captures, and ${sourceCoverage.watchlistMatchCount} watchlist matches.`
                : 'Source-health stream updates with the next operation event.',
            tone: sourceCoverage ? sourceCoverage.activeSourceCount ? 'ready' : 'needs_action' : 'needs_action',
            href: '/api/findings/operations',
        })
        rows.push({
            id: 'inspect_source_inventory',
            label: 'Inspect inventory',
            detail: 'Source inventory, packs, collection state, alerts, watchlists, and deliveries are visible in collection.',
            tone: sourceCoverage ? 'ready' : 'needs_action',
            href: '/api/ti/scraper/control',
        })
        rows.push({
            id: 'open_source_operations',
            label: 'Feeds',
            detail: 'View and manage collection feeds.',
            tone: 'ready',
            href: '/ti/sources',
        })
        for (const action of (selected.actions || []).filter(candidate => candidate.id === 'request_source_coverage' || candidate.id === 'run_canary_collection')) {
            rows.push({
                id: action.id,
                label: action.label,
                detail: `${action.method} ${action.href}.`,
                tone: action.disabledReason ? 'blocked' : 'ready',
                action,
                disabledReason: action.disabledReason,
            })
        }
    }
    if (selected.kind === 'alert_readiness') {
        rows.push({
            id: 'open_alert_generation_readiness',
            label: 'Generation status',
            detail: 'Generated alerts link sources, watchlists, and customer visibility.',
            tone: selected.missingDependency ? 'needs_action' : 'ready',
            href: '/api/findings/alerts/generation-readiness',
        })
        rows.push({
            id: 'inspect_generated_alerts',
            label: 'Generated alerts',
            detail: 'Recent alerts for the selected organization/member workspace.',
            tone: selected.missingDependency ? 'needs_action' : 'ready',
            href: '/api/findings/alerts',
        })
        rows.push({
            id: 'open_dwm_alert_workflow',
            label: 'Open dark web cases',
            detail: 'Open dark web cases to update watched terms, rebuild alerts, and inspect generated alert state.',
            tone: 'ready',
            href: '/findings',
        })
    }
    return rows
}
