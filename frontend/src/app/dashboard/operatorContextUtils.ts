import type { DwmOperationsSnapshot, OperatorScope } from './operatorConsoleTypes'

export function derivedWatchlistMatchCount(operations?: DwmOperationsSnapshot | null) {
    if (!operations) return 0
    return operations.counts.watchlistMatchCount || new Set((operations.latestCaptures ?? []).flatMap(capture => capture.matchedWatchTerms ?? []).filter(Boolean)).size
}

export function actionScope(scope: OperatorScope) {
    return scope.organizationId ? { organizationId: scope.organizationId } : { tenantId: scope.tenantId }
}
