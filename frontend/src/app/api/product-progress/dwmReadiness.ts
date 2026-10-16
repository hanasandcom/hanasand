import type { FetchResult } from './routeHelpers'
import type { DwmProductSnapshotReadiness } from '@/utils/productProgress/readinessTypes'
import { rows, latestTimestamp } from './routeHelpers'

export function dwmProductReadiness(input: {
    generatedAt: string
    route: string
    fetch: FetchResult
}): DwmProductSnapshotReadiness {
    const payload = input.fetch.json as {
        schemaVersion?: string
        tenantId?: string
        generatedAt?: string
        watchlist?: unknown[]
        alerts?: Array<{ firstSeenAt?: string, lastSeenAt?: string }>
        sourceCoverage?: unknown[]
        actorOverviews?: unknown[]
        readiness?: { decision?: string, blockers?: string[] }
    } | undefined
    const schemaLoaded = input.fetch.ok && payload?.schemaVersion === 'dwm.product.v1'
    const watchlistTermCount = schemaLoaded ? rows(payload?.watchlist).length : 0
    const alertCount = schemaLoaded ? rows(payload?.alerts).length : 0
    const sourceFamilyCount = schemaLoaded ? rows(payload?.sourceCoverage).length : 0
    const latestAlertAt = schemaLoaded ? latestTimestamp(rows(payload?.alerts).map(row => String(row.lastSeenAt || row.firstSeenAt || ''))) : undefined
    const readinessBlockers = Array.isArray(payload?.readiness?.blockers) ? payload.readiness.blockers.filter(Boolean) : []
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `DWM product route returned HTTP ${input.fetch.status}.`,
        schemaLoaded ? '' : 'DWM product route did not return dwm.product.v1 from the live backend.',
        watchlistTermCount > 0 ? '' : 'DWM monitor did not return watchlist terms.',
        sourceFamilyCount > 0 ? '' : 'DWM monitor did not return source coverage.',
        alertCount > 0 ? '' : 'DWM monitor did not return alert evidence.',
        ...readinessBlockers,
    ].filter(Boolean)
    return {
        schemaVersion: 'dwm.product_snapshot.readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        checkedAt: input.generatedAt,
        source: input.route,
        href: '/findings',
        tenantId: payload?.tenantId,
        watchlistTermCount,
        alertCount,
        sourceFamilyCount,
        actorOverviewCount: schemaLoaded ? rows(payload?.actorOverviews).length : 0,
        latestAlertAt,
        readinessDecision: payload?.readiness?.decision,
        blockers,
        ownerLane: 'dwm',
        unavailableReason: blockers.length ? 'missing_dwm_product_snapshot' : undefined,
        staleAfterSeconds: 900,
        proofTimestamp: latestAlertAt || payload?.generatedAt || input.generatedAt,
        expectedDashboardRowId: 'dwm_product_snapshot',
        integrationProbeHint: 'GET /api/findings/product must return watchlist, source coverage, and alert evidence from the TI backend.',
        backendProofContractVersion: 'dwm.product.v1',
        detail: blockers.length
            ? blockers.join('; ')
            : `${watchlistTermCount} watchlist term${watchlistTermCount === 1 ? '' : 's'}, ${alertCount} alert${alertCount === 1 ? '' : 's'}, and ${sourceFamilyCount} source famil${sourceFamilyCount === 1 ? 'y' : 'ies'} flowing through the DWM monitor.`,
    }
}
