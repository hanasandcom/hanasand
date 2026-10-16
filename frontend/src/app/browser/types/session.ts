import type { SiteNetwork } from '../SiteNetworkDetails'
import type { SandboxEvidence } from './evidence'

type SessionState = 'prompt' | 'queued' | 'connecting' | 'live' | 'ended' | 'failed' | 'unreachable'
type SocketState = 'closed' | 'connecting' | 'open' | 'error'
type StreamStats = { fps?: number; latencyMs?: number }
type RunTiming = {
    expiresAt: string
    suspiciousExtended: boolean
    freeExtensionUsed: boolean
    paidExtensionUsed: boolean
}
type BrowserNetwork = 'regular' | 'tor'
type BrowserFingerprint = {
    id: string
    label: string
    userAgent: string
    width: number
    height: number
    locale: string
    timezoneId: string
    platform: string
    isMobile?: boolean
    hasTouch?: boolean
}
type UserAgentLabel = { label: string; pattern: RegExp }
type SandboxCapacity = {
    activeSessions: number
    queuedSessions: number
    maxSessions: number
    queuePosition?: number
}
type SandboxProfile = {
    id: string
    name: string
    tools: SandboxTool[]
}
type SandboxTool = {
    id: string
    name: string
    url: string
}
type Capture = {
    id: string
    kind: 'page' | 'tool'
    label: string
    url: string
    target?: string
    title?: string
    capturedAt: string
    reason?: string
    image?: string | null
    frameWidth?: number
    frameHeight?: number
    frameQuality?: FrameQuality
    error?: string
    evidence?: SandboxEvidence
    toolAnalysis?: SandboxToolAnalysis
    networkSummary?: SandboxNetworkSummary
    webcrackLoad?: SandboxWebCrackLoad
    deobfuscatedCode?: string
}
type FrameQuality = {
    looksBlank?: boolean
    visibleTextLength?: number
    elementCount?: number
    visibleMedia?: number
    bodyHeight?: number
    viewportWidth?: number
    viewportHeight?: number
}
type SandboxWebCrackLoad = {
    loaded?: boolean
    scriptId?: string
    source?: string
    sampleBytes?: number
    action?: string
    reason?: string
}
type SandboxNetworkSummary = {
    site?: SiteNetwork
    requestCount?: number
    responseCount?: number
    failedCount?: number
    uniqueDomainCount?: number
    domains?: string[]
    recentRequests?: Array<{ url?: string; method?: string; resourceType?: string; status?: number; host?: string; mimeType?: string; initiator?: string; durationMs?: number; ip?: string; asn?: string; port?: number; protocol?: string; tlsIssuer?: string; tlsSubject?: string; tlsValidFrom?: number; tlsValidTo?: number; failure?: string; at?: string }>
    statusCounts?: Record<string, number>
    redirectChain?: string[]
    downloads?: Array<{ id?: string; url?: string; fileName?: string; bytes?: number; sha256?: string; hashStatus?: string; at?: string; virusTotal?: { status: string; flagged?: number; total?: number; reportUrl?: string; detail?: string } }>
    recentFailures?: Array<{ url?: string; failure?: string; at?: string }>
    lastUpdatedAt?: string
}
type SandboxToolAnalysis = {
    toolKind?: string
    vendorFlagged?: number
    vendorTotal?: number
    alertCount?: number
    communityCommentCount?: number
    communityComments?: string[]
    communitySummary?: string
    verdict?: string
    extractedSignals?: string[]
    webcrackLoaded?: boolean
    webcrackScriptId?: string
    webcrackSampleBytes?: number
    webcrackLoadReason?: string
    threatAssociations?: SandboxThreatAssociation[]
}
type SandboxThreatAssociation = {
    name?: string
    category?: 'actor' | 'malware' | 'ransomware' | 'tool' | 'campaign'
    confidence?: 'high' | 'medium' | 'low'
    evidence?: string
    source?: 'rendered_page' | 'tool_context' | 'decoded_script'
}
