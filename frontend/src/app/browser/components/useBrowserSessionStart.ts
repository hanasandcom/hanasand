'use client'

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { BrowserQuota, BrowserRunHistory, Capture, SandboxCapacity, SandboxProfile, SessionState, SocketState, StreamStats, RunTiming } from '../types'
import { BrowserControlSocket } from '../controlSocket'
import { getCookie } from '@/utils/cookies/cookies'
import { getOrCreateBrowserClientId } from '../browserClientId'
import { inferNetwork, parsePayload } from '../browserValues'
import { defaultTools, normalizeTarget, sessionId, brokerBaseUrl, brokerUrlForSession, scrollRouteFrameToTop } from '../browserSetup'
import type { BrowserRunOverride } from './BrowserWorkspaceTypes'
import { handleBrowserConnectionMessage } from './browserSocketConnection'
import { handleBrowserEvidenceMessage } from './browserSocketEvidence'
import { handleBrowserStatusMessage } from './browserSocketStatus'

type Setter<T> = Dispatch<SetStateAction<T>>
type BrowserMetadata = { userAgent: string; width: number; height: number; locale: string; timezoneId: string; platform: string; isMobile: boolean; hasTouch: boolean }
type BrowserSessionStartOptions = {
    target: string; setTarget: Setter<string>; selectedProfile: SandboxProfile; browserMetadata: BrowserMetadata; quota: BrowserQuota | null; socketRef: MutableRefObject<BrowserControlSocket | null>; replacementRef: MutableRefObject<ReturnType<typeof setTimeout> | null>; recoveryDeadlineRef: MutableRefObject<number>; recoveryAttemptsRef: MutableRefObject<number>; receivedEvidenceRef: MutableRefObject<boolean>; stoppedRunRef: MutableRefObject<boolean>; stoppedEarlyRef: MutableRefObject<boolean>
    setShowStoredResult: Setter<boolean>; setQuickRun: Setter<boolean>; setSelectedProfileId: Setter<string>; setCurrentRunId: Setter<string>; setShareStatus: Setter<string>; setShareUrl: Setter<string>; setShareError: Setter<string>; setCaptures: Setter<Capture[]>; setConsoleEvents: Setter<string[]>; setProviderConsoleEvents: Setter<string[]>; setActiveImage: Setter<string | null>; setReportOpen: Setter<boolean>; setStartupStage: Setter<number>; setRunBlocker: Setter<string>; setStreamUrl: Setter<string>; setStreamHasFrame: Setter<boolean>; setStreamStats: Setter<StreamStats>; setRunTiming: Setter<RunTiming | null>; setRunStartedAt: Setter<number | null>; setActiveUrl: Setter<string>; setRemoteTabUrls: Setter<Record<string, string>>; setActiveSandboxTab: Setter<string>; setCapacity: Setter<SandboxCapacity | null>; setSessionState: Setter<SessionState>; setSocketState: Setter<SocketState>; setClockNow: Setter<number>; setHistory: Setter<BrowserRunHistory[]>; setQuota: Setter<BrowserQuota | null>; setActiveFrame: Setter<{ width: number; height: number }>; pushEvent: (event: string) => void; pushConsoleEvent: (event: string, provider?: boolean) => void; refreshRunStats: () => Promise<void>
}

export function useBrowserSessionStart(options: BrowserSessionStartOptions) {
    const { target, setTarget, selectedProfile, browserMetadata, quota, socketRef, replacementRef, recoveryDeadlineRef, recoveryAttemptsRef, receivedEvidenceRef, stoppedRunRef, stoppedEarlyRef, setShowStoredResult, setQuickRun, setSelectedProfileId, setCurrentRunId, setShareStatus, setShareUrl, setShareError, setCaptures, setConsoleEvents, setProviderConsoleEvents, setActiveImage, setReportOpen, setStartupStage, setRunBlocker, setStreamUrl, setStreamHasFrame, setStreamStats, setRunTiming, setRunStartedAt, setActiveUrl, setRemoteTabUrls, setActiveSandboxTab, setCapacity, setSessionState, setSocketState, setClockNow, setHistory, setQuota, setActiveFrame, pushEvent, pushConsoleEvent, refreshRunStats } = options
const startRun = useCallback(function startRun(override?: BrowserRunOverride) {
    const url = normalizeTarget(override?.target ?? target)
    if (!url) return
    setShowStoredResult(false)
    if (replacementRef.current) clearTimeout(replacementRef.current)
    replacementRef.current = null
    if (!override?.recovery) {
        setQuickRun(Boolean(override?.quick))
        if (override?.quick) setSelectedProfileId('triage-default')
        recoveryAttemptsRef.current = 0
        recoveryDeadlineRef.current = Date.now() + (quota?.sessionSeconds || 90) * 1000
        scrollRouteFrameToTop('auto')
    }
    const id = sessionId()
    const resumeToken = crypto.randomUUID()
    const socket = new BrowserControlSocket(brokerUrlForSession(brokerBaseUrl, id), resumeToken)
    const runNetwork = inferNetwork(url)
    if (override?.target) setTarget(override.target)
    socketRef.current?.close()
    socketRef.current = socket
    const runState = { receivedEnd: false, lastPageUrl: url, replacing: false }
    if (!override?.recovery) receivedEvidenceRef.current = false
    stoppedRunRef.current = false
    stoppedEarlyRef.current = false
    setCurrentRunId(id)
    setShareStatus('')
    setShareUrl('')
    setShareError('')
    if (!override?.recovery) {
        setCaptures([])
        setConsoleEvents([])
        setProviderConsoleEvents([])
        setActiveImage(null)
    }
    setReportOpen(false)
    setStartupStage(0)
    setRunBlocker('')
    setStreamUrl('')
    setStreamHasFrame(false)
    setStreamStats({})
    setRunTiming(null)
    if (!override?.recovery) setRunStartedAt(Date.now())
    setActiveUrl(url)
    setRemoteTabUrls({ browser: url })
    setActiveSandboxTab('browser')
    setCapacity(null)
    setSessionState('connecting')
    setSocketState('connecting')
    pushEvent(override?.recovery ? 'Reconnecting…' : `Launching isolated browser for ${url}.`)
    const replaceSandbox = () => {
        if (runState.replacing || stoppedRunRef.current || socketRef.current !== socket) return
        runState.replacing = true
        runState.receivedEnd = true
        socket.close()
        setStreamUrl('')
        setSocketState('connecting')
        setRunBlocker('')
        setSessionState('connecting')
        pushEvent('Reconnecting…')
        const delay = Math.min(1000 * 2 ** recoveryAttemptsRef.current++, 15000)
        replacementRef.current = setTimeout(() => {
            replacementRef.current = null
            if (stoppedRunRef.current || socketRef.current !== socket) return
            if (Date.now() >= recoveryDeadlineRef.current) {
                setSessionState('ended')
                setRunBlocker('The session ended while reconnecting.')
                return
            }
            startRun({ target: runState.lastPageUrl, recovery: true, quick: override?.quick })
        }, delay)
    }

    socket.onopen = () => {
        setSocketState('open')
        const profileTools = override?.quick ? defaultTools : selectedProfile.tools
        socket.send(JSON.stringify({
            type: 'start',
            resumeToken,
            sessionId: id,
            network: runNetwork,
            target: url,
            durationSeconds: Math.max(1, Math.ceil((recoveryDeadlineRef.current - Date.now()) / 1000)),
            profileTools,
            ...browserMetadata,
            clientId: getOrCreateBrowserClientId(),
            userId: getCookie('id') || undefined,
            sessionToken: getCookie('access_token') || undefined,
        }))
    }
    socket.onreconnecting = () => {
        if (socketRef.current === socket && !stoppedRunRef.current) setSocketState('connecting')
    }
    socket.onclose = () => {
        if (socketRef.current !== socket) return
        setSocketState('closed')
        setStreamUrl('')
        if (!runState.receivedEnd && !stoppedRunRef.current) {
            replaceSandbox()
            return
        }
        pushEvent('Sandbox closed.')
    }
    socket.onerror = () => {
        if (socketRef.current !== socket) return
        setSocketState('error')
        pushEvent('Sandbox broker errored.')
    }
    socket.onmessage = (message) => {
        if (socketRef.current !== socket || stoppedRunRef.current || runState.replacing) return
        if (typeof message.data !== 'string') return
        const payload = parsePayload(message.data)
        if (!payload) return
        const context = { payload, socket, runState, override, id, url, runNetwork, socketRef, stoppedRunRef, receivedEvidenceRef, recoveryDeadlineRef, replaceSandbox, refreshRunStats, pushEvent, pushConsoleEvent, setSocketState, setStreamUrl, setCaptures, setStreamStats, setRunTiming, setClockNow, setCapacity, setHistory, setQuota, setSessionState, setRunBlocker, setActiveImage, setActiveUrl, setRemoteTabUrls, setActiveFrame, setStartupStage, setActiveSandboxTab, setConsoleEvents, setProviderConsoleEvents }
        handleBrowserConnectionMessage(context)
        handleBrowserEvidenceMessage(context)
        handleBrowserStatusMessage(context)

    }
}, [browserMetadata, pushConsoleEvent, pushEvent, refreshRunStats, selectedProfile.tools, quota?.advancedAnalysis, quota?.sessionSeconds, target])
    return startRun
}
