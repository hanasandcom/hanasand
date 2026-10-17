import type { Browser, BrowserContext, Page } from 'playwright'
import type { FileReputation } from './downloads.ts'
import { BrowserRunNetworkTelemetry } from './networkTelemetry.ts'
import { extractIndicators, extractThreatAssociations } from './analysis.ts'
import type { SandboxDeobfuscationTask } from './providerTypes.ts'
import type { PageEvidence } from './pageEvidence.ts'

export type FrameQuality = {
    looksBlank: boolean
    visibleTextLength: number
    elementCount: number
    visibleMedia: number
    bodyHeight: number
    viewportWidth: number
    viewportHeight: number
}

export type SessionState = {
    browser: Browser | null
    context: BrowserContext | null
    page: Page | null
    toolPages: Map<string, Page>
    activeRemoteTabId: string
    ownsBrowser: boolean
    closeTimer: NodeJS.Timeout | null
    runStartedAt: number
    runExpiresAt: number
    suspiciousExtensionApplied: boolean
    freeExtensionUsed: boolean
    paidExtensionUsed: boolean
    cancelAdmission: (() => void) | null
    cancelAdmissionWait: (() => void) | null
    releaseAdmission: (() => void) | null
    currentRunId: string | null
    runLeaseTimer: NodeJS.Timeout | null
    terminalRunStatus: 'ended' | 'failed' | 'unreachable'
    closed: boolean
    runGeneration: number
    sessionEnding: boolean
    lastFrame: string
    remoteClipboard: string
    editableSelectAllArmed: boolean
    networkTelemetry: BrowserRunNetworkTelemetry
    downloadTargets: Set<string>
    fileLookups: Map<string, Promise<FileReputation>>
    fileLookupQueue: Promise<void>
    downloadsInFlight: number
    downloadCount: number
    cachedDeobfuscationTasks: SandboxDeobfuscationTask[]
    cachedThreatAssociations: ReturnType<typeof extractThreatAssociations>
    cachedIndicators: ReturnType<typeof extractIndicators> | null
    cachedFrameQuality: FrameQuality | null
    cachedPageEvidence: PageEvidence | null
    lastHeavyFrameAt: number
    firstFrameAttemptedAt: number
    fastFrameInFlight: boolean
    interactionFrameTimer: NodeJS.Timeout | null
    openingBackgroundTabs: number
    documentEvidencePromises: Promise<void>[]
}

export function createSessionState(): SessionState {
    return {
        browser: null,
        context: null,
        page: null,
        toolPages: new Map(),
        activeRemoteTabId: 'browser',
        ownsBrowser: false,
        closeTimer: null,
        runStartedAt: 0,
        runExpiresAt: 0,
        suspiciousExtensionApplied: false,
        freeExtensionUsed: false,
        paidExtensionUsed: false,
        cancelAdmission: null,
        cancelAdmissionWait: null,
        releaseAdmission: null,
        currentRunId: null,
        runLeaseTimer: null,
        terminalRunStatus: 'ended',
        closed: false,
        runGeneration: 0,
        sessionEnding: false,
        lastFrame: '',
        remoteClipboard: '',
        editableSelectAllArmed: false,
        networkTelemetry: new BrowserRunNetworkTelemetry(),
        downloadTargets: new Set(),
        fileLookups: new Map(),
        fileLookupQueue: Promise.resolve(),
        downloadsInFlight: 0,
        downloadCount: 0,
        cachedDeobfuscationTasks: [],
        cachedThreatAssociations: [],
        cachedIndicators: null,
        cachedFrameQuality: null,
        cachedPageEvidence: null,
        lastHeavyFrameAt: 0,
        firstFrameAttemptedAt: 0,
        fastFrameInFlight: false,
        interactionFrameTimer: null,
        openingBackgroundTabs: 0,
        documentEvidencePromises: [],
    }
}
