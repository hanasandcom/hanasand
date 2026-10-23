import type { Capture, SandboxCapacity, SandboxProfile, SessionState, SocketState, StreamStats } from './types'
import { resolveToolUrl } from './browserSetup'
import { providerErrorText, providerStatus, selectToolCapture } from './browserProviderData'
import { downloadEvidenceLine, formatEpochDate } from './browserRunData'
import { isUsefulFrameImage, networkPeerSummary, buildAnalystSummary } from './browserAnalystSummary'

export function buildExportReport(input: {
    target: string
    activeUrl: string
    sessionState: SessionState
    socketState: SocketState
    profile: SandboxProfile
    summary: ReturnType<typeof buildAnalystSummary>
    captures: Capture[]
    events: string[]
    consoleEvents: string[]
    providerConsoleEvents: string[]
    capacity: SandboxCapacity | null
    streamStats: StreamStats
    metricEvent: string
}) {
    return {
        exportedAt: new Date().toISOString(),
        target: input.target,
        finalUrl: input.activeUrl || input.summary.urlTimeline[0]?.url || input.target,
        status: {
            run: input.sessionState,
            connection: input.socketState,
            capacity: input.capacity,
            metrics: { ...input.streamStats, event: input.metricEvent },
        },
        profile: input.profile,
        analystSummary: {
            narrative: input.summary.narrative,
            brief: input.summary.brief,
            rows: input.summary.rows,
            indicators: input.summary.indicators,
            threatAssociations: input.summary.threatAssociations,
            urlTimeline: input.summary.urlTimeline,
        },
        analystReport: buildShareableAnalystReport(input),
        captures: input.captures.map(capture => ({
            kind: capture.kind,
            label: capture.label,
            url: capture.url,
            title: capture.title,
            capturedAt: capture.capturedAt,
            reason: capture.reason,
            error: providerErrorText(capture.error),
            image: capture.image,
            frameQuality: capture.frameQuality,
            evidence: capture.evidence,
            networkSummary: capture.networkSummary,
            toolAnalysis: capture.toolAnalysis,
            webcrackLoad: capture.webcrackLoad,
            deobfuscatedCode: capture.deobfuscatedCode,
        })),
        activityEvents: input.events,
        consoleEvents: input.consoleEvents,
        providerConsoleEvents: input.providerConsoleEvents,
        events: input.events,
    }
}

export function buildShareableAnalystReport(input: Parameters<typeof buildExportReport>[0]) {
    const pageCaptures = input.captures.filter(capture => capture.kind === 'page')
    const toolCaptures = input.captures.filter(capture => capture.kind === 'tool')
    const latestNetwork = pageCaptures.find(capture => capture.networkSummary)?.networkSummary
    const providerReports = input.profile.tools.filter(tool => {
        const capture = selectToolCapture(toolCaptures, tool, input.target)
        return tool.id !== 'webcrack' || Boolean(capture?.deobfuscatedCode || capture?.webcrackLoad?.sampleBytes)
    }).map(tool => {
        const capture = selectToolCapture(toolCaptures, tool, input.target)
        const analysis = capture?.toolAnalysis
        return {
            tool: tool.name,
            status: providerStatus(capture, analysis),
            url: capture?.url || resolveToolUrl(tool.url, input.activeUrl || input.target),
            verdict: analysis?.verdict && analysis.verdict !== 'unknown' ? analysis.verdict : undefined,
            vendorFlagged: analysis?.vendorFlagged,
            vendorTotal: analysis?.vendorTotal,
            alertCount: analysis?.alertCount,
            communityCommentCount: analysis?.communityCommentCount,
            communityComments: analysis?.communityComments,
            communitySummary: analysis?.communitySummary,
            screenshotCaptured: Boolean(capture?.image),
            deobfuscatedCode: capture?.deobfuscatedCode,
            signals: analysis?.extractedSignals || [],
            threatAssociations: analysis?.threatAssociations || [],
            error: providerErrorText(capture?.error),
        }
    })
    const scriptArtifacts = [
        ...pageCaptures.flatMap(capture => capture.evidence?.scripts || []).map(script => ({
            scriptId: script.id,
            source: script.src || 'inline',
            sha256: script.sha256,
            assessment: (script.obfuscationScore || 0) >= 3 ? 'suspicious' : 'observed',
            summary: [
                script.inlineBytes !== undefined ? `${script.inlineBytes} inline bytes` : '',
                script.obfuscationScore !== undefined ? `obfuscation score ${script.obfuscationScore}` : '',
                ...(script.reasons || []),
            ].filter(Boolean).join(' · '),
        })),
        ...pageCaptures.flatMap(capture => capture.evidence?.deobfuscationTasks || []).map(task => ({
            scriptId: task.scriptId,
            source: task.source,
            sha256: task.sha256,
            assessment: task.assessment,
            summary: task.summary,
            indicators: task.indicators,
        })),
    ]
    const resourceUrls = Array.from(new Set(pageCaptures.flatMap(capture => capture.evidence?.sourceUrls || []))).filter(Boolean)
    const urlStates = Array.from(new Set(input.summary.urlTimeline.map(item => item.url).filter(Boolean)))
    const peerSummary = networkPeerSummary(latestNetwork)
    const scriptHashCount = new Set(scriptArtifacts.map(script => script.sha256).filter(Boolean)).size
    const report = {
        verdict: input.summary.brief.verdict,
        target: input.target,
        finalUrl: input.activeUrl || input.summary.urlTimeline[0]?.url || input.target,
        exportedAt: new Date().toISOString(),
        evidenceChecklist: {
            renderedScreenshots: pageCaptures.filter(capture => capture.image && isUsefulFrameImage(capture.image) && !capture.frameQuality?.looksBlank).length,
            providerReports: providerReports.filter(report => report.status === 'Results').length,
            networkRequests: latestNetwork?.requestCount || 0,
            contactedDomains: latestNetwork?.uniqueDomainCount || 0,
            redirectStates: input.summary.urlTimeline.length,
            downloadsHashed: latestNetwork?.downloads?.filter(download => download.sha256).length || 0,
            scriptHashes: scriptHashCount,
            copyableIndicators: input.summary.indicators.length,
        },
        providerReports,
        networkEvidence: latestNetwork ? {
            requests: latestNetwork.requestCount,
            responses: latestNetwork.responseCount,
            blockedOrFailed: latestNetwork.failedCount,
            contactedDomains: latestNetwork.domains,
            finalUrl: input.activeUrl || input.summary.urlTimeline.at(-1)?.url || input.target,
            redirectChain: latestNetwork.redirectChain,
            urlStates,
            peerSummary,
            downloads: latestNetwork.downloads,
            recentRequests: latestNetwork.recentRequests?.slice(-50),
        } : null,
        scriptArtifacts,
        resourceUrls,
        urlTimeline: input.summary.urlTimeline,
        indicators: input.summary.indicators,
        threatAssociations: input.summary.threatAssociations,
        recommendedActions: input.summary.brief.nextSteps,
    }
    return {
        ...report,
        markdown: [
            '# Sandbox report',
            `Target: ${report.target}`,
            `Final URL: ${report.finalUrl}`,
            `Verdict: ${report.verdict}`,
            '',
            '## Evidence',
            ...Object.entries(report.evidenceChecklist).map(([key, value]) => `- ${key}: ${value}`),
            '',
            '## Providers',
            ...providerReports.map(provider => `- ${provider.tool}: ${provider.status}${provider.verdict ? `, verdict ${provider.verdict}` : ''}${provider.communitySummary ? `, ${provider.communitySummary}` : ''}${provider.signals.length ? `, signals ${provider.signals.slice(0, 4).join(' | ')}` : ''}${provider.error ? `, error ${provider.error}` : ''}`),
            '',
            '## Network',
            `- requests: ${latestNetwork?.requestCount || 0}`,
            `- responses: ${latestNetwork?.responseCount || 0}`,
            `- blocked/failed: ${latestNetwork?.failedCount || 0}`,
            `- final URL: ${report.finalUrl}`,
            ...urlStates.slice(0, 12).map(url => `- URL state: ${url}`),
            ...peerSummary.slice(0, 12).map(peer => `- peer: ${[peer.host, peer.ip, peer.asn ? `AS${peer.asn}` : '', peer.protocol || '', peer.tlsSubject ? `cert ${peer.tlsSubject}` : '', peer.tlsIssuer || '', peer.tlsValidTo ? `expires ${formatEpochDate(peer.tlsValidTo)}` : ''].filter(Boolean).join(', ')}`),
            ...((latestNetwork?.domains || []).slice(0, 20).map(domain => `- domain: ${domain}`)),
            ...((latestNetwork?.redirectChain || []).slice(0, 10).map(url => `- redirect: ${url}`)),
            ...((latestNetwork?.downloads || []).slice(0, 10).map(download => `- download: ${downloadEvidenceLine(download).replaceAll('\n', ', ')}`)),
            '',
            '## URLs',
            ...resourceUrls.slice(0, 40).map(url => `- ${url}`),
            '',
            '## Script artifacts',
            ...scriptArtifacts.slice(0, 12).map(script => `- ${script.assessment || 'script'}: ${script.scriptId || script.source || 'sample'}${script.sha256 ? `, sha256 ${script.sha256}` : ''}`),
            '',
            '## Threat context',
            ...report.threatAssociations.slice(0, 12).map(item => `- ${item.name || 'Threat association'}${item.category ? `, ${item.category}` : ''}${item.confidence ? `, ${item.confidence} confidence` : ''}${item.evidence ? `, ${item.evidence}` : ''}`),
            '',
            '## Indicators',
            ...report.indicators.slice(0, 80).map(indicator => `- ${indicator}`),
            '',
            ...(report.recommendedActions.length ? ['## Recommended actions', ...report.recommendedActions.map(action => `- ${action}`)] : []),
        ].join('\n'),
    }
}
