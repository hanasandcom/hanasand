import { arrayOfStrings, numberValue, objectValue, stringValue, type JsonRecord } from './watchlistDwmValues'

export type DwmWatchlistMirrorAlertPreview = {
    id: string
    detailRoute: string
    sourceFamily?: string
    matchedTerm?: string
    severity?: string
    recommendedRoute?: string
    evidenceCount?: number
    evidenceExcerpt?: string
    firstSeenAt?: string
    lastSeenAt?: string
}

export function buildDwmWatchlistMirrorAlertPreview(payload: JsonRecord): DwmWatchlistMirrorAlertPreview | undefined {
    const alert = objectValue(payload.alert) ?? payload
    const id = stringValue(alert.id ?? payload.alertId)
    if (!id) return undefined
    const evidence = Array.isArray(alert.evidence) ? alert.evidence : []
    const evidenceSummary = objectValue(alert.evidenceSummary)
    const workflowContext = objectValue(alert.workflowContext)
    const matchReason = objectValue(alert.matchReason ?? workflowContext?.matchReason)
    const matchedTermRecord = objectValue(alert.matchedTerm) ?? objectValue(matchReason?.matchedTerm)
    const sourceFamilies = arrayOfStrings(evidenceSummary?.sourceFamilies)
    const firstEvidence = evidence.map(objectValue).find(Boolean) ?? {}
    const matchedTerm = stringValue(matchedTermRecord?.value ?? alert.matchedTerm ?? matchReason?.matchedTerm)
    return {
        id,
        detailRoute: stringValue(alert.alertDetailPath ?? payload.alertDetailPath) || `/findings?alert=${encodeURIComponent(id)}`,
        sourceFamily: stringValue(alert.sourceFamily ?? sourceFamilies[0] ?? workflowContext?.sourceFamily),
        matchedTerm,
        severity: stringValue(alert.severityOverride ?? alert.severity),
        recommendedRoute: stringValue(alert.recommendedRoute ?? workflowContext?.recommendedRoute),
        evidenceCount: numberValue(evidenceSummary?.evidenceCount ?? workflowContext?.evidenceCount ?? evidence.length),
        evidenceExcerpt: stringValue(firstEvidence.excerpt ?? alert.evidenceExcerpt ?? evidenceSummary?.primaryExcerpt),
        firstSeenAt: stringValue(alert.firstSeenAt ?? evidenceSummary?.firstObservedAt ?? workflowContext?.firstObservedAt),
        lastSeenAt: stringValue(alert.lastSeenAt ?? evidenceSummary?.lastObservedAt ?? workflowContext?.lastObservedAt ?? alert.updatedAt),
    }
}
