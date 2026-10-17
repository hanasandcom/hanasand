export type BrokerPayload = {
    type?: string
    state?: string
    reason?: string
    url?: string
    target?: string
    title?: string
    text?: string
    source?: string
    tabId?: string
    level?: string
    line?: number
    image?: string | null
    width?: number
    height?: number
    frameQuality?: { looksBlank?: boolean; visibleTextLength?: number; elementCount?: number }
    torProxyConfigured?: boolean
    evidence?: {
        textExcerpt?: string
        verdict?: string
        reasons?: string[]
        communityComments?: string[]
        indicators?: { domains?: string[]; ips?: string[]; urls?: string[] }
        obfuscatedScripts?: unknown[]
        deobfuscationTasks?: Array<{
            assessment?: string
            summary?: string
            decodedPreview?: string
            indicators?: { domains?: string[]; ips?: string[]; urls?: string[] }
        }>
        threatAssociations?: Array<{ name?: string; category?: string; source?: string }>
    }
    toolAnalysis?: {
        toolKind?: string
        vendorFlagged?: number
        vendorTotal?: number
        alertCount?: number
        communityCommentCount?: number
        communityComments?: string[]
        communitySummary?: string
        extractedSignals?: string[]
    }
    webcrackLoad?: {
        loaded?: boolean
        sampleBytes?: number
        reason?: string
    }
    networkSummary?: {
        recentRequests?: Array<{ method?: string; resourceType?: string; status?: number; host?: string; mimeType?: string; initiator?: string; durationMs?: number; url?: string; asn?: string }>
        downloads?: Array<{ url?: string; fileName?: string; bytes?: number; sha256?: string; hashStatus?: string }>
    }
    receivedAt?: number
    expiresAt?: string
    suspiciousExtended?: boolean
    freeExtensionUsed?: boolean
    paidExtensionUsed?: boolean
}
