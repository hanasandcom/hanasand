import type { Capture, SandboxProfile, SandboxToolAnalysis } from './types'
import { isBrowserErrorUrl } from './browserSetup'
import { hasParsedProviderResult, matchesTool, selectToolCapture, virusTotalVendorLabel } from './browserProviderData'
import { buildAnalystBrief, cleanEvidenceComment, dedupeThreatAssociations } from './browserBrief'

export function isUsefulFrameImage(image: string) {
    return image.length > 24_000
}

export function networkPeerSummary(network?: SandboxNetworkSummary) {
    const peers = new Map<string, NonNullable<SandboxNetworkSummary['recentRequests']>[number]>()
    for (const request of network?.recentRequests || []) {
        if (!request.ip && !request.asn && !request.tlsSubject && !request.tlsIssuer) continue
        const key = [request.host, request.ip, request.asn, request.protocol, request.tlsSubject, request.tlsIssuer, request.tlsValidTo].filter(Boolean).join('|')
        if (!peers.has(key)) peers.set(key, request)
    }
    return Array.from(peers.values()).slice(0, 40)
}

export function buildAnalystSummary(target: string, captures: Capture[], profile: SandboxProfile) {
    const pageCaptures = captures.filter(capture => capture.kind === 'page' && capture.reason !== 'download')
    const toolCaptures = captures.filter(capture => capture.kind === 'tool')
    const redirected = new Set(pageCaptures.map(capture => capture.url)).size > 1
    const navigationFailed = pageCaptures.some(capture => isBrowserErrorUrl(capture.url || capture.evidence?.url || ''))
    const toolAnalyses = toolCaptures.map(capture => capture.toolAnalysis).filter(Boolean) as SandboxToolAnalysis[]
    const virusTotal = toolAnalyses.find(item => item.toolKind === 'virustotal')
    const urlquery = toolAnalyses.find(item => item.toolKind === 'urlquery')
    const suspiciousCaptures = pageCaptures.filter(capture => capture.evidence?.verdict === 'suspicious')
    const obfuscatedScripts = pageCaptures.flatMap(capture => capture.evidence?.obfuscatedScripts || [])
    const deobfuscationTasks = pageCaptures.flatMap(capture => capture.evidence?.deobfuscationTasks || [])
    const suspiciousDeobfuscationTasks = deobfuscationTasks.filter(task => task.assessment === 'suspicious')
    const webcrackLoads = captures.flatMap(capture => capture.webcrackLoad ? [capture.webcrackLoad] : [])
    const webcrackLoaded = webcrackLoads.filter(load => load.loaded).length
    const comments = Array.from(new Set(toolCaptures.flatMap(capture => [
        ...(capture.toolAnalysis?.communityComments || []),
        ...(capture.evidence?.communityComments || []),
    ]).map(cleanEvidenceComment).filter(Boolean))).slice(0, 4) as string[]
    const confidence = Math.max(0, ...captures.map(capture => capture.evidence?.confidence || 0))
    const latestNetwork = captures.find(capture => capture.kind === 'page' && capture.networkSummary)?.networkSummary
    const failedRequests = latestNetwork?.failedCount || 0
    const decodedIndicators = suspiciousDeobfuscationTasks.flatMap(task => [
        ...(task.indicators?.domains || []),
        ...(task.indicators?.ips || []),
        ...(task.indicators?.urls || []),
    ])
    const providerDetected = (virusTotal?.vendorFlagged || 0) > 0 || (urlquery?.alertCount || 0) > 0
    const allIndicators = usefulIndicators([
        ...(providerDetected ? [target] : []),
        ...suspiciousCaptures.map(capture => capture.url || capture.evidence?.url || '').filter(Boolean),
        ...decodedIndicators,
    ])
    const deobfuscationSummary = deobfuscationTasks.find(task => task.summary)?.summary || 'No decoded malicious payload summary is available yet.'
    const capturedToolCount = profile.tools.filter(tool => toolCaptures.some(capture => matchesTool(capture, tool))).length
    const threatAssociations = dedupeThreatAssociations([
        ...captures.flatMap(capture => capture.evidence?.threatAssociations || []),
        ...toolAnalyses.flatMap(analysis => analysis.threatAssociations || []),
        ...deobfuscationTasks.flatMap(task => task.threatAssociations || []),
    ])
    const urlTimeline = pageCaptures
        .map(capture => ({
            url: capture.url || capture.evidence?.url || target,
            capturedAt: capture.capturedAt,
            reason: capture.reason || 'capture',
            title: capture.title || '',
        }))
        .filter(item => item.url)
        .reverse()
    const screenshotCount = pageCaptures.filter(capture => capture.image).length
    const suspicious = suspiciousCaptures.length > 0 || providerDetected || suspiciousDeobfuscationTasks.length > 0
        || Boolean(latestNetwork?.downloads?.some(file => file.virusTotal?.flagged))
    const reasons = suspiciousCaptures.flatMap(capture => capture.evidence?.reasons || []).slice(0, 3)
    const findings = suspicious
        ? `Suspicious activity was observed${reasons.length ? `: ${reasons.join('; ')}` : ''}.`
        : 'No signs of suspicious activity was observed.'
    const threatNarrative = threatAssociations.length
        ? `Threat associations: ${threatAssociations.slice(0, 4).map(item => `${item.name} (${item.category || 'context'}, ${item.confidence || 'low'})`).join('; ')}.`
        : ''
    const narrative = pageCaptures.length
        ? navigationFailed
            ? `Could not load ${target || 'the submitted URL'}. Captured a browser error page.`
            : [`Loaded ${target || 'the submitted URL'} and captured ${screenshotCount} screenshot${screenshotCount === 1 ? '' : 's'}.`, findings, threatNarrative].filter(Boolean).join(' ')
        : `Preparing ${target || 'the submitted URL'}.`
    const brief = buildAnalystBrief({
        target,
        navigationFailed,
        pageCaptureCount: pageCaptures.length,
        redirected,
        virusTotal,
        urlquery,
        suspiciousCaptureCount: suspiciousCaptures.length + (latestNetwork?.downloads?.filter(file => file.virusTotal?.flagged).length || 0),
        incompleteChecks: profile.tools.some(tool => !hasParsedProviderResult(selectToolCapture(toolCaptures, tool, target)?.toolAnalysis)) || Boolean(latestNetwork?.downloads?.some(file => file.virusTotal?.status !== 'known')),
        suspiciousDeobfuscationCount: suspiciousDeobfuscationTasks.length,
        obfuscatedScriptCount: obfuscatedScripts.length,
        webcrackLoaded,
        threatAssociations,
        indicatorCount: allIndicators.length,
        failedRequests,
        confidence,
        latestCapturedAt: pageCaptures[0]?.capturedAt || toolCaptures[0]?.capturedAt || '',
    })

    return {
        narrative,
        brief,
        indicators: allIndicators,
        threatAssociations,
        latestNetwork,
        navigationFailed,
        urlTimeline,
        deobfuscationTasks,
        deobfuscationSummary,
        webcrackLoaded,
        rows: [
            { label: 'Screenshots', value: String(pageCaptures.filter(capture => capture.image).length) },
            { label: 'Navigation status', value: navigationFailed ? 'target unreachable' : 'loaded' },
            { label: 'Profile tools', value: `${capturedToolCount}/${profile.tools.length}` },
            { label: 'VirusTotal vendors', value: virusTotal?.vendorFlagged !== undefined ? virusTotalVendorLabel(virusTotal) : 'unknown' },
            { label: 'urlquery alerts', value: urlquery?.alertCount !== undefined ? String(urlquery.alertCount) : 'unknown' },
            { label: 'Community comments', value: String(Math.max(virusTotal?.communityCommentCount || 0, urlquery?.communityCommentCount || 0, comments.length)) },
            { label: 'Redirect observed', value: redirected ? 'yes' : 'no' },
            { label: 'Network requests', value: latestNetwork?.requestCount !== undefined ? String(latestNetwork.requestCount) : 'unknown' },
            { label: 'Contacted domains', value: latestNetwork?.uniqueDomainCount !== undefined ? String(latestNetwork.uniqueDomainCount) : 'unknown' },
            { label: 'Blocked/failed requests', value: String(failedRequests) },
            { label: 'Suspicious captures', value: String(suspiciousCaptures.length) },
            { label: 'Threat context', value: threatAssociations.length ? threatAssociations.map(item => item.name).slice(0, 3).join(', ') : 'none extracted' },
            { label: 'URL states', value: String(urlTimeline.length) },
            { label: 'Obfuscated scripts', value: String(obfuscatedScripts.length) },
            { label: 'WebCrack loaded', value: String(webcrackLoaded) },
            { label: 'Copyable indicators', value: String(allIndicators.length) },
        ],
    }
}

export function usefulIndicators(values: string[]) {
    return Array.from(new Set(values.map(item => item.toLowerCase().trim()).filter(item => item && isUsefulIndicator(item)))).slice(0, 80)
}

export function isUsefulIndicator(value: string) {
    if (/^https?:\/\//i.test(value)) return isUsefulUrlIndicator(value)
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return value.split('.').every(part => Number(part) >= 0 && Number(part) <= 255)
    return /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i.test(value) && isUsefulDomainIndicator(value)
}

const GENERIC_DOTTED_INDICATORS = new Set([
    'document.createelement',
    'document.body',
    'document.head',
    'document.cookie',
    'document.location',
    'window.location',
    'window.history',
    'object.assign',
    'object.create',
    'json.parse',
    'json.stringify',
    'console.log',
    'el.style',
    'el.textcontent',
    'element.style',
])
const ANALYSIS_TOOL_DOMAINS = new Set(['virustotal.com', 'www.virustotal.com', 'urlquery.net', 'www.urlquery.net', 'webcrack.netlify.app'])

export function isUsefulDomainIndicator(value: string) {
    const normalized = value.toLowerCase()
    if (ANALYSIS_TOOL_DOMAINS.has(normalized)) return false
    if (GENERIC_DOTTED_INDICATORS.has(normalized)) return false
    return !/^(?:document|window|object|array|string|number|console|json|math|element|el|node|event|navigator|location|history|localstorage|sessionstorage)\./i.test(normalized)
}

export function isUsefulUrlIndicator(value: string) {
    try {
        const url = new URL(value)
        return isUsefulDomainIndicator(url.hostname)
    } catch {
        return false
    }
}
