import type { NetworkRequestRow } from './ReportComponents'
import type { SiteNetwork } from '../SiteNetworkDetails'
import type { RunMetrics } from '../BrowserRunMetrics'

export type BrowserReport = {
    siteNetwork?: SiteNetwork
    runId?: string
    runs?: Array<{ id: string; startedAt: string; status: string }>
    target?: string
    finalUrl?: string
    exportedAt?: string
    consoleEvents?: string[]
    providerConsoleEvents?: string[]
    status?: { metrics?: RunMetrics; run?: string; connection?: string; capacity?: { activeSessions?: number; maxSessions?: number; queuedSessions?: number; queuePosition?: number } }
    captures?: Array<{
        kind?: string
        label?: string
        url?: string
        title?: string
        capturedAt?: string
        reason?: string
        image?: string | null
        networkSummary?: { recentRequests?: NetworkRequestRow[] }
        frameQuality?: { looksBlank?: boolean; visibleTextLength?: number; elementCount?: number }
        evidence?: { verdict?: string; sourceUrls?: string[]; textExcerpt?: string; sourceCode?: string }
    }>
    analystSummary?: {
        narrative?: string
        indicators?: string[]
        threatAssociations?: Array<{ name?: string; category?: string; confidence?: string; evidence?: string; source?: string }>
        urlTimeline?: Array<{ url?: string; capturedAt?: string; reason?: string; title?: string }>
    }
    analystReport?: {
        verdict?: string
        evidenceChecklist?: Record<string, number>
        providerReports?: Array<{ tool?: string; status?: string; verdict?: string; url?: string; vendorFlagged?: number; vendorTotal?: number; alertCount?: number; communityCommentCount?: number; communityComments?: string[]; communitySummary?: string; screenshotCaptured?: boolean; deobfuscatedCode?: string; signals?: string[]; threatAssociations?: Array<{ name?: string; confidence?: string; source?: string }>; error?: string }>
        networkEvidence?: {
            requests?: number
            responses?: number
            blockedOrFailed?: number
            contactedDomains?: string[]
            finalUrl?: string
            redirectChain?: string[]
            urlStates?: string[]
            peerSummary?: NetworkRequestRow[]
            downloads?: Array<{ url?: string; fileName?: string; bytes?: number; sha256?: string; hashStatus?: string; virusTotal?: { status?: string; flagged?: number; total?: number; detail?: string } }>
            recentRequests?: NetworkRequestRow[]
        }
        scriptArtifacts?: Array<{ scriptId?: string; source?: string; sha256?: string; assessment?: string; summary?: string; indicators?: { domains?: string[]; ips?: string[]; urls?: string[] } }>
        resourceUrls?: string[]
        urlTimeline?: Array<{ url?: string; capturedAt?: string; reason?: string; title?: string }>
        indicators?: string[]
        threatAssociations?: Array<{ name?: string; category?: string; confidence?: string; evidence?: string; source?: string }>
        recommendedActions?: string[]
        markdown?: string
    }
}
