import type { BrowserReport } from './reportTypes'

export function providerVendorLabel(provider: { vendorFlagged?: number; vendorTotal?: number }) {
    const flagged = provider.vendorFlagged ?? 0
    return provider.vendorTotal ? `${flagged}/${provider.vendorTotal}` : `${flagged} flagged`
}

export function reportUrlTimeline(report: BrowserReport) {
    return report.analystReport?.urlTimeline?.length ? report.analystReport.urlTimeline : report.analystSummary?.urlTimeline || []
}

export function reportResourceUrls(report: BrowserReport) {
    return Array.from(new Set([...(report.analystReport?.resourceUrls || []), ...(report.captures || []).filter(capture => capture.kind !== 'tool').flatMap(capture => capture.evidence?.sourceUrls || [])])).filter(Boolean)
}

export function reportIndicators(report: BrowserReport) {
    return Array.from(new Set([...(report.analystReport?.indicators || []), ...(report.analystSummary?.indicators || [])])).filter(Boolean)
}

export function reportThreatAssociations(report: BrowserReport) {
    return report.analystReport?.threatAssociations?.length ? report.analystReport.threatAssociations : report.analystSummary?.threatAssociations || []
}



export function scriptIndicatorList(script: NonNullable<NonNullable<BrowserReport['analystReport']>['scriptArtifacts']>[number]) {
    return [...(script.indicators?.domains || []), ...(script.indicators?.ips || []), ...(script.indicators?.urls || [])]
}
