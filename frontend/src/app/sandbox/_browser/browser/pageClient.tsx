'use client'

import { BrowserControlSocket } from './controlSocket'
import BrowserReportPageClient from './report/pageClient'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BrowserInitialData, BrowserQuota, BrowserRunHistory, BrowserRunStats, Capture, RunTiming, SandboxCapacity, SandboxProfile, SessionState, SocketState, StreamStats } from './types'
import { defaultProfiles, browserFingerprints, userAgentLabel, normalizeTarget, browserViewportForStream } from './browserSetup'
import { clampUiNumber, quotaValue } from './browserValues'
import { getOrCreateBrowserClientId } from './browserClientId'
import { sanitizeHistory, historyDomainKey } from './historyData'
export { sanitizeHistory } from './historyData'
import { buildAnalystSummary } from './browserAnalystSummary'
import { sessionStateLabel } from './browserRunData'
import { selectToolCapture, hasParsedProviderResult } from './browserProviderData'
import { compactBrowserEvent } from './components/BrowserStatus'
import { BrowserLanding } from './components/BrowserLanding'
import { BrowserWorkspace } from './components/BrowserWorkspace'
import { useBrowserProfileSync } from './components/useBrowserProfileSync'
import { useBrowserProfileActions } from './components/useBrowserProfileActions'
import { useBrowserHistoryActions } from './components/useBrowserHistoryActions'
import { useBrowserReportActions } from './components/useBrowserReportActions'
import { useBrowserSessionActions } from './components/useBrowserSessionActions'
import { useBrowserSessionStart } from './components/useBrowserSessionStart'
import { useBrowserViewportInput } from './components/useBrowserViewportInput'
import { useBrowserStreamMonitor } from './components/useBrowserStreamMonitor'

export default function BrowserPageClient({ initialData, resultId, resultRunId }: { initialData: BrowserInitialData; resultId?: string; resultRunId?: string }) {
    const [formReady, setFormReady] = useState(false)
    const [target, setTarget] = useState('')
    const [sessionState, setSessionState] = useState<SessionState>('prompt')
    const [socketState, setSocketState] = useState<SocketState>('closed')
    const [profiles, setProfiles] = useState<SandboxProfile[]>(defaultProfiles)
    const [selectedProfileId, setSelectedProfileId] = useState(defaultProfiles[0].id)
    const [fingerprintId, setFingerprintId] = useState(browserFingerprints[0].id)
    const [customUserAgent, setCustomUserAgent] = useState(browserFingerprints[0].userAgent)
    const [customViewportWidth, setCustomViewportWidth] = useState(String(browserFingerprints[0].width))
    const [customViewportHeight, setCustomViewportHeight] = useState(String(browserFingerprints[0].height))
    const [customLocale, setCustomLocale] = useState(browserFingerprints[0].locale)
    const [customTimezoneId, setCustomTimezoneId] = useState(browserFingerprints[0].timezoneId)
    const [customPlatform, setCustomPlatform] = useState(browserFingerprints[0].platform)
    const [captures, setCaptures] = useState<Capture[]>([])
    const [reportOpen, setReportOpen] = useState(false)
    const [activeImage, setActiveImage] = useState<string | null>(null)
    const [streamUrl, setStreamUrl] = useState('')
    const [streamHasFrame, setStreamHasFrame] = useState(false)
    const [streamNeedsGesture, setStreamNeedsGesture] = useState(false)
    const [streamFrame, setStreamFrame] = useState<{ width: number; height: number } | null>(null)
    const [streamStats, setStreamStats] = useState<StreamStats>({})
    const receivedEvidenceRef = useRef(false)
    const stoppedRunRef = useRef(false)
    const stoppedEarlyRef = useRef(false)
    const streamRef = useRef<HTMLIFrameElement | null>(null)
    useBrowserStreamMonitor({ streamUrl, streamRef, receivedEvidenceRef, setStreamHasFrame, setStreamFrame, setStreamNeedsGesture, setStreamStats })
    const [runTiming, setRunTiming] = useState<RunTiming | null>(null)
    const [clockNow, setClockNow] = useState(Date.now())
    const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
    const [activeFrame, setActiveFrame] = useState<{ width: number; height: number }>({ width: 1280, height: 720 })
    const [activeUrl, setActiveUrl] = useState('')
    const [remoteTabUrls, setRemoteTabUrls] = useState<Record<string, string>>({})
    const [runBlocker, setRunBlocker] = useState('')
    const [events, setEvents] = useState<string[]>(['Sandbox ready.'])
    const [consoleEvents, setConsoleEvents] = useState<string[]>([])
    const [providerConsoleEvents, setProviderConsoleEvents] = useState<string[]>([])
    const [startupStage, setStartupStage] = useState(0)
    const [activeSandboxTab, setActiveSandboxTab] = useState('browser')
    const [customProfileName, setCustomProfileName] = useState('')
    const [customToolName, setCustomToolName] = useState('')
    const [customToolUrl, setCustomToolUrl] = useState('')
    const [profilesLoaded, setProfilesLoaded] = useState(false)
    const [profileSyncEnabled, setProfileSyncEnabled] = useState(false)
    const [profileSyncState, setProfileSyncState] = useState<'local' | 'loading' | 'synced' | 'saving' | 'error'>('loading')
    const [capacity, setCapacity] = useState<SandboxCapacity | null>(null)
    const [history, setHistory] = useState<BrowserRunHistory[]>(() => sanitizeHistory(initialData.history))
    const [quota, setQuota] = useState<BrowserQuota | null>(() => quotaValue(initialData.quota))
    const [runStats, setRunStats] = useState<BrowserRunStats | null>(() => initialData.stats)
    const [historyReady, setHistoryReady] = useState(() => initialData.history.length > 0)
    const [showStoredResult, setShowStoredResult] = useState(Boolean(resultId))
    const [resultClientId, setResultClientId] = useState('')
    useEffect(() => { setResultClientId(getOrCreateBrowserClientId()) }, [])
    const [currentRunId, setCurrentRunId] = useState('')
    const [quickRun, setQuickRun] = useState(false)
    const [shareStatus, setShareStatus] = useState('')
    const [shareUrl, setShareUrl] = useState('')
    const [shareError, setShareError] = useState('')
    const socketRef = useRef<BrowserControlSocket | null>(null)
    const replacementRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const recoveryDeadlineRef = useRef(0)
    const recoveryAttemptsRef = useRef(0)

    const normalizedTarget = useMemo(() => normalizeTarget(target), [target])
    const selectedProfile = useMemo(() => (quota?.advancedAnalysis ? profiles : defaultProfiles).find(profile => profile.id === selectedProfileId) || defaultProfiles[0], [profiles, selectedProfileId, quota?.advancedAnalysis])
    const selectedFingerprint = useMemo(() => browserFingerprints.find(item => item.id === fingerprintId) || browserFingerprints[0], [fingerprintId])
    const activeUserAgentLabel = useMemo(() => userAgentLabel(customUserAgent, selectedFingerprint.label), [customUserAgent, selectedFingerprint.label])
    const browserMetadata = useMemo(() => {
        const requestedWidth = clampUiNumber(customViewportWidth, 320, 3840, selectedFingerprint.width)
        const requestedHeight = clampUiNumber(customViewportHeight, 320, 2160, selectedFingerprint.height)
        return {
            userAgent: customUserAgent.trim() || selectedFingerprint.userAgent,
            ...browserViewportForStream(requestedWidth, requestedHeight),
            locale: customLocale.trim() || selectedFingerprint.locale,
            timezoneId: customTimezoneId.trim() || selectedFingerprint.timezoneId,
            platform: customPlatform.trim() || selectedFingerprint.platform,
            isMobile: selectedFingerprint.isMobile,
            hasTouch: selectedFingerprint.hasTouch,
        }
    }, [customLocale, customPlatform, customTimezoneId, customUserAgent, customViewportHeight, customViewportWidth, selectedFingerprint])
    const summary = useMemo(() => buildAnalystSummary(normalizedTarget, captures, selectedProfile), [captures, normalizedTarget, selectedProfile])
    const toolCaptures = useMemo(() => captures.filter(capture => capture.kind === 'tool'), [captures])
    const checksWithoutVerdict = selectedProfile.tools.filter(tool => {
        const capture = selectToolCapture(toolCaptures, tool, normalizedTarget)
        return tool.id === 'webcrack' ? Boolean(capture?.webcrackLoad?.sampleBytes && capture.error) : !hasParsedProviderResult(capture?.toolAnalysis)
    })
    const [reviewChecksOpen, setReviewChecksOpen] = useState(false)
    const latestPageImage = useMemo(() => captures.find(capture => capture.kind === 'page' && capture.image && !capture.frameQuality?.looksBlank)?.image || null, [captures])
    const activeTool = useMemo(() => selectedProfile.tools.find(tool => tool.id === activeSandboxTab), [activeSandboxTab, selectedProfile.tools])
    const activeToolCapture = activeTool ? selectToolCapture(toolCaptures, activeTool, normalizedTarget) : undefined
    const activeViewportImage = activeTool ? activeToolCapture?.image || null : activeImage || latestPageImage
    const siteNetwork = captures.findLast(capture => capture.networkSummary?.site && historyDomainKey(capture.networkSummary.site.url) === historyDomainKey(activeUrl || normalizedTarget))?.networkSummary?.site
    const viewportFrame = streamUrl ? streamFrame || browserMetadata : activeToolCapture?.frameWidth && activeToolCapture?.frameHeight ? { width: activeToolCapture.frameWidth, height: activeToolCapture.frameHeight } : activeFrame
    const runRemainingSeconds = runTiming ? Math.max(0, Math.ceil((new Date(runTiming.expiresAt).getTime() - clockNow) / 1000)) : 0
    const paidBrowserPlan = Boolean(quota?.paid)
    const { applyFingerprint, saveProfile, deleteProfile, addToolToSelectedProfile, removeToolFromSelectedProfile } = useBrowserProfileActions({ profiles, setProfiles, selectedProfile, selectedProfileId, setSelectedProfileId, customProfileName, setCustomProfileName, customToolName, setCustomToolName, customToolUrl, setCustomToolUrl, setFingerprintId, setCustomUserAgent, setCustomViewportWidth, setCustomViewportHeight, setCustomLocale, setCustomTimezoneId, setCustomPlatform })
    const { refreshRunStats, deleteHistory, shareFinding } = useBrowserHistoryActions({ initialStats: initialData.stats, history, setHistory, setHistoryReady, setQuota, setRunStats })

    const runIsActive = sessionState === 'queued' || sessionState === 'connecting' || sessionState === 'live'
    const clockIsActive = Boolean((runStartedAt && runIsActive) || (runTiming && sessionState === 'live'))
    const metricEvent = sessionState === 'ended' ? stoppedRunRef.current ? 'Stopped' : 'Completed' : sessionState === 'failed' ? 'Failed' : compactBrowserEvent(events[0] || sessionStateLabel(sessionState))
    const runMetrics = { ...streamStats, capacity, event: metricEvent }
    const { exportReport, saveReport } = useBrowserReportActions({ target: normalizedTarget, activeUrl, sessionState, socketState, selectedProfile, summary, captures, events, consoleEvents, providerConsoleEvents, capacity, streamStats, metricEvent, currentRunId, setHistory, setShareStatus, setShareUrl, setShareError, stoppedEarlyRef })
    useEffect(() => {
        if (!runIsActive) {
            setStreamUrl('')
            setStreamHasFrame(false)
        }
    }, [runIsActive])
    const loadingBrowser = runIsActive && !runBlocker && !activeImage && !latestPageImage && !streamHasFrame && !streamNeedsGesture
    const fallbackInteractive = sessionState === 'live' && socketState === 'open' && !streamUrl && !activeTool && Boolean(activeViewportImage)
    const waitingForFrame = runIsActive && !activeViewportImage && !streamUrl
    const waitingSeconds = runStartedAt && runIsActive && waitingForFrame ? Math.floor((clockNow - runStartedAt) / 1000) : 0

    useEffect(() => {
        setFormReady(true)
    }, [])

    useEffect(() => {
        if (!clockIsActive) return
        setClockNow(Date.now())
        const timer = window.setInterval(() => setClockNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [runIsActive, runStartedAt, runTiming, sessionState])

    const pushEvent = useCallback((event: string) => {
        setEvents(current => [event, ...current].slice(0, 8))
    }, [])
    const pushConsoleEvent = useCallback((event: string, provider = false) => {
        const update = provider ? setProviderConsoleEvents : setConsoleEvents
        update(current => {
            const next = [...current, event.slice(0, 8000)].slice(-500)
            let length = next.reduce((total, entry) => total + entry.length, 0)
            while (length > 96_000) length -= next.shift()!.length
            return next
        })
    }, [])

    useBrowserProfileSync({ profiles, setProfiles, profilesLoaded, setProfilesLoaded, profileSyncEnabled, setProfileSyncEnabled, setProfileSyncState, activeSandboxTab, setActiveSandboxTab, selectedProfile })

    useEffect(() => () => {
        if (replacementRef.current) clearTimeout(replacementRef.current)
        socketRef.current?.close()
        socketRef.current = null
    }, [])

    const startRun = useBrowserSessionStart({ target, setTarget, selectedProfile, browserMetadata, quota, socketRef, replacementRef, recoveryDeadlineRef, recoveryAttemptsRef, receivedEvidenceRef, stoppedRunRef, stoppedEarlyRef, setShowStoredResult, setQuickRun, setSelectedProfileId, setCurrentRunId, setShareStatus, setShareUrl, setShareError, setCaptures, setConsoleEvents, setProviderConsoleEvents, setActiveImage, setReportOpen, setStartupStage, setRunBlocker, setStreamUrl, setStreamHasFrame, setStreamStats, setRunTiming, setRunStartedAt, setActiveUrl, setRemoteTabUrls, setActiveSandboxTab, setCapacity, setSessionState, setSocketState, setClockNow, setHistory, setQuota, setActiveFrame, pushEvent, pushConsoleEvent, refreshRunStats })

    const { viewportRef, imageRef, keyBrowserFrame } = useBrowserViewportInput({ activeFrame, fallbackInteractive, socketRef })
    const { selectSandboxTab, extendRun, stopRun, resetRun } = useBrowserSessionActions({ runIsActive, selectedProfile, toolCaptures, normalizedTarget, setActiveSandboxTab, setReportOpen, socketRef, setSessionState, setSocketState, setStreamUrl, setStreamHasFrame, setCaptures, setRunBlocker, setActiveImage, setStreamStats, setRunTiming, setRunStartedAt, setActiveUrl, setCapacity, pushEvent, quickRun, setQuickRun, stoppedRunRef, stoppedEarlyRef, runStartedAt, replacementRef, setShowStoredResult })

    const landingProps = { formReady, target, setTarget, normalizedTarget, startRun: () => startRun(), capacity, runStats, customUserAgent, customViewportWidth, customViewportHeight, streamResolution: { width: browserMetadata.width, height: browserMetadata.height }, customLocale, customTimezoneId, customPlatform, activeUserAgentLabel, setCustomUserAgent, setCustomViewportWidth, setCustomViewportHeight, setCustomLocale, setCustomTimezoneId, setCustomPlatform, applyFingerprint, paidBrowserPlan, profiles, selectedProfile, setSelectedProfileId, deleteProfile, profileSyncState, customProfileName, setCustomProfileName, saveProfile, customToolName, customToolUrl, setCustomToolName, setCustomToolUrl, addToolToSelectedProfile, removeToolFromSelectedProfile, history, quota, historyReady, deleteHistory, shareFinding, resultClientId }

    if (showStoredResult && resultId) return <BrowserReportPageClient initialRun={resultRunId} resultId={resultId} clientId={resultClientId} onRerun={(url, quick) => startRun({ target: url, quick })} />

    if (sessionState === 'prompt') return <BrowserLanding {...landingProps} />

    const workspaceProps = { loadingBrowser, startupStage, runStartedAt, clockNow, normalizedTarget, capacity, stopRun, activeSandboxTab, sessionState, socketState, selectedProfile, toolCaptures, remoteTabUrls, activeUrl, siteNetwork, selectSandboxTab, runTiming, runRemainingSeconds, paidBrowserPlan, extendRun, exportReport, captures, currentRunId, shareStatus, saveReport, resetRun, shareUrl, setShareStatus, shareError, setShareError, runMetrics, reportOpen, setReportOpen, summary, checksWithoutVerdict, reviewChecksOpen, setReviewChecksOpen, startRun, stoppedRunRef, stoppedEarlyRef, runIsActive, runBlocker, viewportRef, streamUrl, viewportFrame, fallbackInteractive, keyBrowserFrame, streamRef, streamHasFrame, streamNeedsGesture, activeTool, activeToolCapture, activeViewportImage, imageRef, waitingSeconds, waitingForFrame, consoleEvents }
    return <BrowserWorkspace {...workspaceProps} />
}
