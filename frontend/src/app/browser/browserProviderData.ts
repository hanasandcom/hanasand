import type { Capture, SandboxTool, SandboxToolAnalysis } from './types'
import { safeToolKey } from './browserValues'

export function virusTotalVendorLabel(analysis: Pick<SandboxToolAnalysis, 'vendorFlagged' | 'vendorTotal'>) {
    const flagged = analysis.vendorFlagged ?? 0
    return analysis.vendorTotal ? `${flagged}/${analysis.vendorTotal}` : `${flagged} flagged`
}

export function matchesTool(capture: Capture, tool: SandboxTool) {
    const toolId = safeToolKey(tool.id)
    const label = capture.label.toLowerCase()
    const kind = capture.toolAnalysis?.toolKind?.toLowerCase()
    return label.includes(toolId) || label.includes(tool.name.toLowerCase()) || kind === toolId
}

export function selectToolCapture(captures: Capture[], tool: SandboxTool, target = '') {
    const normalizedHost = target ? hostWithoutWww(target) : ''
    let parsedCapture: Capture | undefined
    let imageCapture: Capture | undefined
    let firstMatch: Capture | undefined

    for (const capture of captures) {
        if (!matchesTool(capture, tool)) continue
        if (normalizedHost && capture.target && hostWithoutWww(capture.target) !== normalizedHost) continue

        firstMatch ??= capture
        if (capture.error === 'provider_navigation_pending') continue

        const hasResult = hasParsedProviderResult(capture.toolAnalysis)
        if (hasResult && capture.image) return capture
        if (hasResult) parsedCapture ??= capture
        if (capture.image) imageCapture ??= capture
    }

    return parsedCapture || imageCapture || firstMatch
}

export function hostWithoutWww(value: string) {
    try {
        return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
        return value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    }
}


export function providerStatus(capture?: Capture, analysis?: SandboxToolAnalysis) {
    if (!capture) return 'Unavailable'
    if (capture.error === 'provider_navigation_pending') return 'Loading'
    if (noProviderReport(capture.error)) return 'No report'
    if (providerBlocked(capture.error)) return 'Blocked'
    if (analysis?.toolKind === 'webcrack' && capture.error) return 'Provider error'
    if (analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded === false && /no obfuscated (?:script sample|code)/i.test(analysis.webcrackLoadReason || '')) return 'No obfuscated code'
    if (hasParsedProviderResult(analysis)) return 'Results'
    if (capture.error) return 'Provider error'
    return 'Result unavailable'
}

export function providerTabStatus(capture?: Capture, analysis?: SandboxToolAnalysis) {
    if (!capture) return 'waiting'
    if (noProviderReport(capture.error)) return 'no report'
    if (analysis?.vendorFlagged !== undefined) return `${virusTotalVendorLabel(analysis)} vendors`
    if (analysis?.alertCount !== undefined) return `${analysis.alertCount} alerts`
    if (analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded === true) return 'code loaded'
    if (analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded === false) return /no obfuscated (?:script sample|code)/i.test(analysis.webcrackLoadReason || '') ? 'no obfuscated code' : 'not loaded'
    if (capture.error === 'provider_navigation_pending') return 'loading'
    if (capture.error) return providerBlocked(capture.error) ? 'blocked' : /pending|still running/i.test(capture.error) ? 'loading' : /timeout|timed out/i.test(capture.error) ? 'timed out' : 'unavailable'
    return analysis?.verdict && analysis.verdict !== 'unknown' ? analysis.verdict : 'unavailable'
}

export function providerDetail(analysis?: SandboxToolAnalysis, capture?: Capture) {
    if (analysis?.vendorFlagged !== undefined) return `VirusTotal vendors: ${virusTotalVendorLabel(analysis)}${analysis.communityCommentCount !== undefined ? ` · ${communityCommentLabel(analysis.communityCommentCount)}` : ''}`
    if (analysis?.alertCount !== undefined) return `urlquery alerts: ${analysis.alertCount}${analysis.communityCommentCount !== undefined ? ` · ${communityCommentLabel(analysis.communityCommentCount)}` : ''}`
    if (analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded === false && /no obfuscated (?:script sample|code)/i.test(analysis.webcrackLoadReason || '')) return 'No obfuscated code was found on this page.'
    if (analysis?.extractedSignals?.length) return analysis.extractedSignals.slice(0, 2).join(' · ')
    if (capture?.error === 'provider_navigation_pending') return 'Provider tab is open and loading in the sandbox.'
    if (noProviderReport(capture?.error)) return 'No existing report was found. No verdict was returned.'
    if (capture?.error) return providerErrorText(capture.error)
    if (capture) return 'Provider tab captured, but no parsed verdict was returned.'
    return 'Provider tab has not returned a capture yet.'
}

function noProviderReport(error?: string) {
    return Boolean(error && /no (?:matching |existing )?(?:urlquery )?report|no existing (?:url )?analysis|item not found/i.test(error))
}

function providerBlocked(error?: string) {
    return Boolean(error && /captcha|access denied|denied browser access|forbidden|blocked/i.test(error))
}

export function providerErrorText(error?: string) {
    if (!error || error === 'provider_navigation_pending') return ''
    const lower = error.toLowerCase()
    if (lower.includes('screenshot') && lower.includes('timeout')) return 'Provider screenshot timed out.'
    if (lower.includes('timeout')) return 'Provider timed out.'
    if (lower.includes('net::err')) return `Provider connection failed (${error.match(/net::ERR_[A-Z_]+/i)?.[0] || 'network error'}).`
    return error.split('\n')[0].slice(0, 140)
}

export function communityCommentLabel(count: number) {
    return `${count} community comment${count === 1 ? '' : 's'}`
}

export function hasParsedProviderResult(analysis?: SandboxToolAnalysis) {
    return analysis?.vendorFlagged !== undefined
        || analysis?.alertCount !== undefined
        || Boolean(analysis?.verdict && analysis.verdict !== 'unknown')
        || Boolean(analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded !== undefined)
}
