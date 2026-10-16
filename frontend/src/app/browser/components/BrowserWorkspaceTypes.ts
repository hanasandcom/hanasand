import type { Dispatch, KeyboardEvent, MutableRefObject, RefObject, SetStateAction } from 'react'
import type { BrowserNetwork, Capture, SandboxCapacity, SandboxProfile, SandboxTool, SessionState, SocketState, RunTiming } from '../types'
import type { SiteNetwork } from '../SiteNetworkDetails'
import type { RunMetrics } from '../BrowserRunMetrics'
import type { buildAnalystSummary } from '../browserAnalystSummary'

export type BrowserRunOverride = {
    target?: string
    network?: BrowserNetwork
    recovery?: boolean
    quick?: boolean
}

export type BrowserWorkspaceProps = {
    loadingBrowser: boolean
    startupStage: number
    runStartedAt: number | null
    clockNow: number
    normalizedTarget: string
    capacity: SandboxCapacity | null
    stopRun: () => void
    activeSandboxTab: string
    sessionState: SessionState
    socketState: SocketState
    selectedProfile: SandboxProfile
    toolCaptures: Capture[]
    remoteTabUrls: Record<string, string>
    activeUrl: string
    siteNetwork?: SiteNetwork
    selectSandboxTab: (id: string) => void
    runTiming: RunTiming | null
    runRemainingSeconds: number
    paidBrowserPlan: boolean
    extendRun: (extension: 'free' | 'paid') => void
    exportReport: () => void
    captures: Capture[]
    currentRunId: string
    shareStatus: string
    saveReport: () => Promise<void> | void
    resetRun: () => void
    shareUrl: string
    setShareStatus: Dispatch<SetStateAction<string>>
    shareError: string
    setShareError: Dispatch<SetStateAction<string>>
    runMetrics: RunMetrics
    reportOpen: boolean
    setReportOpen: Dispatch<SetStateAction<boolean>>
    summary: ReturnType<typeof buildAnalystSummary>
    checksWithoutVerdict: SandboxTool[]
    reviewChecksOpen: boolean
    setReviewChecksOpen: Dispatch<SetStateAction<boolean>>
    startRun: (override?: BrowserRunOverride) => void
    stoppedRunRef: MutableRefObject<boolean>
    stoppedEarlyRef: MutableRefObject<boolean>
    runIsActive: boolean
    runBlocker: string
    viewportRef: RefObject<HTMLDivElement | null>
    streamUrl: string
    viewportFrame: { width: number; height: number }
    fallbackInteractive: boolean
    keyBrowserFrame: (event: KeyboardEvent<HTMLDivElement>) => void
    streamRef: RefObject<HTMLIFrameElement | null>
    streamAttempt: number
    streamHasFrame: boolean
    streamNeedsGesture: boolean
    activeTool?: SandboxTool
    activeToolCapture?: Capture
    activeViewportImage: string | null
    imageRef: RefObject<HTMLImageElement | null>
    waitingSeconds: number
    waitingForFrame: boolean
    consoleEvents: string[]
}
