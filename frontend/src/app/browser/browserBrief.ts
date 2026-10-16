import type { SandboxThreatAssociation, SandboxToolAnalysis } from './types'

export function buildAnalystBrief(input: {
    target: string
    navigationFailed: boolean
    pageCaptureCount: number
    redirected: boolean
    virusTotal?: SandboxToolAnalysis
    urlquery?: SandboxToolAnalysis
    suspiciousCaptureCount: number
    incompleteChecks: boolean
    suspiciousDeobfuscationCount: number
    obfuscatedScriptCount: number
    webcrackLoaded: number
    threatAssociations: SandboxThreatAssociation[]
    indicatorCount: number
    failedRequests: number
    confidence: number
    latestCapturedAt: string
}) {
    const vtFlagged = input.virusTotal?.vendorFlagged || 0
    const urlqueryAlerts = input.urlquery?.alertCount || 0
    const highSignal = Boolean(vtFlagged || urlqueryAlerts || input.suspiciousCaptureCount || input.suspiciousDeobfuscationCount)
    let verdict = 'Insufficient external evidence'
    let impact = 'No browser evidence has been captured yet.'
    let recommendedAction = ''

    if (input.navigationFailed) {
        verdict = 'Target unreachable'
        impact = 'The isolated browser captured an error page, so no clean verdict can be made for the submitted target.'
    } else if (highSignal) {
        verdict = 'Suspicious activity observed'
        impact = `External detections, suspicious rendered evidence, or decoded script indicators were observed for ${input.target || 'the submitted URL'}.`
        recommendedAction = 'Open the evidence workspace, copy indicators, and create or update the alert with the observed route and sourced evidence.'
    } else if (input.pageCaptureCount) {
        verdict = input.incompleteChecks ? 'Checks incomplete — no clean verdict' : 'No signs of suspicious activity.'
        impact = input.incompleteChecks ? 'Some provider or file checks did not return a verdict.' : 'No detections were observed. This does not guarantee the website or its files are safe.'
    }
    const confidence = input.confidence
        ? `${formatConfidencePercent(input.confidence)} evidence confidence`
        : input.virusTotal || input.urlquery
            ? 'Tool evidence parsed, confidence not provided'
            : 'Confidence pending'
    const freshness = input.latestCapturedAt
        ? `Latest capture ${input.latestCapturedAt}`
        : 'No capture timestamp yet'
    const nextSteps = highSignal ? [
        ...(input.indicatorCount ? [`Copy ${input.indicatorCount} indicator${input.indicatorCount === 1 ? '' : 's'} into the alert workflow.`] : []),
        ...(input.suspiciousDeobfuscationCount ? ['Inspect the suspicious decoded script and its URLs.'] : []),
        ...(input.threatAssociations.length ? [`Check threat context: ${input.threatAssociations.slice(0, 2).map(item => item.name).join(', ')}.`] : []),
    ] : []
    return { verdict, impact, recommendedAction, confidence, freshness, nextSteps }
}

export function dedupeThreatAssociations(input: SandboxThreatAssociation[]) {
    const seen = new Set<string>()
    return input
        .filter(item => item?.name)
        .filter(item => {
            const key = `${item.name}:${item.category}:${item.source}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .slice(0, 12)
}

export function cleanEvidenceExcerpt(value?: string) {
    const cleaned = value
        ?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim() || ''
    if (!cleaned || /^(ads do fetching\.?\s*){2,}/i.test(cleaned)) return ''
    return cleaned.length > 260 ? `${cleaned.slice(0, 257)}...` : cleaned
}

export function cleanEvidenceComment(value?: string) {
    const cleaned = cleanEvidenceExcerpt(value)
    if (!cleaned || /^ads do fetching/i.test(cleaned)) return ''
    return cleaned
}

export function formatConfidencePercent(value: number) {
    if (!value) return ''
    const percent = value <= 1 ? Math.round(value * 100) : Math.round(value)
    return `${percent}%`
}
