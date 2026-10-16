import type { OperationsSnapshot, PortalAlert } from './types'

export function uniqueStrings(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map(value => value?.trim() || '').filter(Boolean)))
}

export function latestCaptureWatchlistMatchCount(captures: OperationsSnapshot['latestCaptures']) {
    return uniqueStrings(captures.flatMap(capture => capture.matchedWatchTerms)).length
}

export function alertWatchlistMatchCount(alerts: PortalAlert[]) {
    return uniqueStrings(alerts.map(alert => alert.matchedTerm.value)).length
}
