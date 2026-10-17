import { extractThreatAssociations } from './analysis.ts'
import { cleanAnalystText, uniqueStrings } from './providerText.ts'
import { parseVirusTotalStats, parseUrlQueryScores } from './providerUrlResponses.ts'
import type { collectPageEvidence } from './pageEvidence.ts'
import type { BrowserProviderRunResult } from '../browserSandboxRuns.ts'
import { extractIndicators } from './analysis.ts'
import type { WebCrackLoadResult } from './providerTypes.ts'
export function analyzeToolEvidence(toolName: string, evidence: Awaited<ReturnType<typeof collectPageEvidence>>, webcrackLoad?: WebCrackLoadResult) {
    const tool = toolName.toLowerCase()
    const text = [
        evidence.url || '',
        evidence.textExcerpt || '',
        ...(evidence.comments || []),
        ...(evidence.reasons || []),
    ].join('\n')
    const vendorMatch = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})\s*(?:security\s*)?(?:vendors?|engines?)/i)
        || text.match(/(\d{1,3})\s*\/\s*(\d{1,3})\s+Community Score/i)
        || text.match(/(\d{1,3})\s+(?:security\s*)?(?:vendors?|engines?)\s+(?:flagged|detected|marked)/i)
        || text.match(/(\d{1,3})\s+(?:of)\s+(\d{1,3})\s+security engines?/i)
        || text.match(/(\d{1,3})\s+out of\s+(\d{1,3})\s+engines?/i)
    const urlqueryNoAlertText = /no\s+(?:alerts?|detections?)\s+(?:were|was)?\s*(?:found|detected)?/i.test(text) || /\b0\s+alerts?/i.test(text)
    const communityMatch = text.match(/(\d{1,3})\s+(?:community\s*)?(?:comments?|votes?|reviews?)/i)
    const isVirusTotal = /virus\s*total|virustotal/.test(tool) || /virustotal\.com/i.test(text)
    const isUrlQuery = !isVirusTotal && (/urlquery|urlquery\.net/.test(tool) || /urlquery\.net/i.test(text))
    const alertMatch = isUrlQuery
        ? text.match(/(\d{1,3})\s+(?:alerts?|detections?|blacklists?|malicious requests?)/i)
            || text.match(/Found\s+(\d{1,3})\s+(?:alert|alerts)/i)
        : null
    const vtStats = parseVirusTotalStats(text)
    const urlqueryScores = parseUrlQueryScores(text)
    const rawFlagged = vtStats ? vtStats.flagged : vendorMatch ? Number(vendorMatch[1]) : undefined
    const flagged = Number.isFinite(rawFlagged) ? rawFlagged : undefined
    const total = vtStats?.total || (vendorMatch?.[2] ? Number(vendorMatch[2]) : undefined)
    const alertCount = isUrlQuery ? Number.isFinite(urlqueryScores?.alerts) ? urlqueryScores?.alerts : alertMatch ? Number(alertMatch[1]) : urlqueryNoAlertText ? 0 : undefined : undefined
    const communityComments = uniqueStrings((evidence.communityComments || []).map(comment => cleanAnalystText(comment, 500)).filter(Boolean)).slice(0, 8)
    const communityCommentCount = communityMatch ? Number(communityMatch[1]) : communityComments.length || undefined
    const hasProviderNoDetectionText = /(?:no\s+(?:detections|alerts?|results?|matches?|issues)\s+(?:found)?|undetected|clean|harmless)/i.test(text)
    const hasVendorDetections = flagged !== undefined && Number.isFinite(flagged) && flagged > 0
    const hasUrlQueryAlerts = alertCount !== undefined && Number.isFinite(alertCount) && alertCount > 0
    const hasExplicitMaliciousIndicator = /malicious|phishing|blacklist|detected/i.test(text)
    const hasExplicitBenignIndicator = hasProviderNoDetectionText
    const hasParsedProviderSignal = vendorMatch !== null || alertMatch !== null || communityMatch !== null || Boolean(vtStats || urlqueryScores)

    const verdict = isVirusTotal
        ? total && flagged !== undefined && flagged <= total
            ? (hasVendorDetections ? 'suspicious' : 'clean')
            : 'unknown'
        : isUrlQuery
            ? alertCount !== undefined
                ? (hasUrlQueryAlerts ? 'suspicious' : 'clean')
                : 'unknown'
            : hasExplicitMaliciousIndicator && hasParsedProviderSignal && !hasExplicitBenignIndicator
                ? 'suspicious'
                : hasExplicitBenignIndicator || /no(?:t|) malicious/i.test(text)
                    ? 'clean'
                    : 'unknown'

    return {
        toolKind: isVirusTotal ? 'virustotal' : isUrlQuery ? 'urlquery' : /webcrack/i.test(tool) ? 'webcrack' : 'generic',
        vendorFlagged: Number.isFinite(flagged) ? flagged : undefined,
        vendorTotal: Number.isFinite(total) ? total : undefined,
        alertCount: Number.isFinite(alertCount) ? alertCount : undefined,
        communityCommentCount: Number.isFinite(communityCommentCount) ? communityCommentCount : undefined,
        communityComments,
        communitySummary: communityComments.slice(0, 3).join(' ') || undefined,
        verdict,
        threatAssociations: extractThreatAssociations(text, 'tool_context'),
        extractedSignals: [
            isVirusTotal && Number.isFinite(flagged) ? (Number.isFinite(total) ? `${flagged}/${total} vendors flagged` : `${flagged} vendors flagged`) : '',
            isUrlQuery && Number.isFinite(alertCount) ? `${alertCount} urlquery alert${alertCount === 1 ? '' : 's'}` : '',
            communityCommentCount ? `${communityCommentCount} community comment${communityCommentCount === 1 ? '' : 's'}` : '',
            webcrackLoad?.loaded ? `WebCrack loaded ${webcrackLoad.scriptId || 'script sample'}` : '',
        ].filter(Boolean),
        webcrackLoaded: webcrackLoad?.loaded,
        webcrackScriptId: webcrackLoad?.scriptId,
        webcrackSampleBytes: webcrackLoad?.sampleBytes,
        webcrackLoadReason: webcrackLoad?.reason,
    }
}

export function providerRunResult(analysis: ReturnType<typeof analyzeToolEvidence>, error = ''): BrowserProviderRunResult | null {
    if (analysis.toolKind === 'virustotal') {
        if (!analysis.vendorTotal) return null
        const flagged = analysis.vendorFlagged || 0
        const label = `${flagged}/${analysis.vendorTotal} VT`
        return { status: flagged > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label }
    }
    if (analysis.toolKind === 'urlquery') {
        if (analysis.alertCount === undefined) return null
        const alerts = analysis.alertCount || 0
        return { status: alerts > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: alerts > 0 ? `${alerts}` : 'urlquery' }
    }
    return null
}

export function providerPendingEvidence(url: string, toolName: string, target: string): Awaited<ReturnType<typeof collectPageEvidence>> {
    return {
        url,
        textExcerpt: `${toolName} provider capture queued for ${target}. Parsed provider result is pending or blocked by provider navigation.`,
        indicators: extractIndicators(`${url}\n${target}`),
        sourceCode: '',
        sourceUrls: [],
        comments: [],
        communityComments: [],
        forms: [],
        scripts: [],
        obfuscatedScripts: [],
        verdict: 'unknown',
        confidence: 10,
        reasons: ['Provider result has not returned yet.'],
        threatAssociations: [],
        deobfuscationTasks: [],
    }
}

export function safeToolId(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'tool'
}
