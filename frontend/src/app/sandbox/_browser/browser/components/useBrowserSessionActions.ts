'use client'

import { useCallback, useEffect, type Dispatch, type SetStateAction, type MutableRefObject } from 'react'
import type { Capture, SandboxProfile, SessionState, SocketState, StreamStats, RunTiming, SandboxCapacity } from '../types'
import type { BrowserControlSocket } from '../controlSocket'
import { providerTabStatus, selectToolCapture } from '../browserProviderData'
import { hasParsedProviderResult } from '../browserProviderData'

type BrowserSessionActionsOptions = {
    runIsActive: boolean; selectedProfile: SandboxProfile; toolCaptures: Capture[]; normalizedTarget: string; activeSandboxTab: string; setActiveSandboxTab: Dispatch<SetStateAction<string>>; setReportOpen: Dispatch<SetStateAction<boolean>>; socketRef: MutableRefObject<BrowserControlSocket | null>; setSessionState: Dispatch<SetStateAction<SessionState>>; setSocketState: Dispatch<SetStateAction<SocketState>>; setStreamUrl: Dispatch<SetStateAction<string>>; setStreamHasFrame: Dispatch<SetStateAction<boolean>>; setCaptures: Dispatch<SetStateAction<Capture[]>>; setRunBlocker: Dispatch<SetStateAction<string>>; setActiveImage: Dispatch<SetStateAction<string | null>>; setStreamStats: Dispatch<SetStateAction<StreamStats>>; setRunTiming: Dispatch<SetStateAction<RunTiming | null>>; setRunStartedAt: Dispatch<SetStateAction<number | null>>; setActiveUrl: Dispatch<SetStateAction<string>>; setCapacity: Dispatch<SetStateAction<SandboxCapacity | null>>; pushEvent: (event: string) => void; quickRun: boolean; setQuickRun: Dispatch<SetStateAction<boolean>>; stoppedRunRef: MutableRefObject<boolean>; stoppedEarlyRef: MutableRefObject<boolean>; runStartedAt: number | null; replacementRef: MutableRefObject<ReturnType<typeof setTimeout> | null>; setShowStoredResult: Dispatch<SetStateAction<boolean>>
}

export function useBrowserSessionActions(options: BrowserSessionActionsOptions) {
    const { runIsActive, selectedProfile, toolCaptures, normalizedTarget, setActiveSandboxTab, setReportOpen, socketRef, setSessionState, setSocketState, setStreamUrl, setStreamHasFrame, setCaptures, setRunBlocker, setActiveImage, setStreamStats, setRunTiming, setRunStartedAt, setActiveUrl, setCapacity, pushEvent, quickRun, stoppedRunRef, stoppedEarlyRef, runStartedAt, replacementRef, setShowStoredResult } = options
    const selectSandboxTab = useCallback((tabId: string) => {
        const tool = selectedProfile.tools.find(item => item.id === tabId)
        if (tool && providerTabStatus(selectToolCapture(toolCaptures, tool, normalizedTarget), selectToolCapture(toolCaptures, tool, normalizedTarget)?.toolAnalysis) === 'no obfuscated code') return
        setActiveSandboxTab(tabId)
        if (!runIsActive) setReportOpen(true)
    }, [runIsActive, selectedProfile.tools, toolCaptures, normalizedTarget])

    const extendRun = useCallback((extension: 'free' | 'paid') => {
        const socket = socketRef.current
        if (socket?.readyState !== WebSocket.OPEN) return
        socket.send(JSON.stringify({ type: 'extend', extension }))
    }, [])

    const stopRun = useCallback(() => {
        const socket = socketRef.current
        stoppedRunRef.current = true
        stoppedEarlyRef.current = runStartedAt === null || Date.now() - runStartedAt < 30_000
        if (replacementRef.current) clearTimeout(replacementRef.current)
        replacementRef.current = null
        setStreamUrl('')
        setStreamHasFrame(false)
        socket?.send(JSON.stringify({ type: 'end' }))
        setSessionState('ended')
        pushEvent('Sandbox stopped.')
    }, [pushEvent, runStartedAt])

    useEffect(() => {
        if (!quickRun || !runIsActive || stoppedRunRef.current) return
        const ready = ['virustotal', 'urlquery'].every(kind => toolCaptures.some(capture =>
            capture.toolAnalysis?.toolKind === kind && !capture.error && hasParsedProviderResult(capture.toolAnalysis)))
        if (!ready) return
        stopRun()
        // Successful quick runs are complete even when they take less than 30 seconds.
        stoppedEarlyRef.current = false
    }, [quickRun, runIsActive, stopRun, toolCaptures])

    const resetRun = useCallback(() => {
        stoppedRunRef.current = true
        if (runIsActive) socketRef.current?.send(JSON.stringify({ type: 'end' }))
        window.history.replaceState(null, '', '/sandbox')
        setShowStoredResult(false)
        if (replacementRef.current) clearTimeout(replacementRef.current)
        replacementRef.current = null
        socketRef.current?.close()
        socketRef.current = null
        setSessionState('prompt')
        setSocketState('closed')
        setCaptures([])
        setRunBlocker('')
        setActiveImage(null)
        setStreamUrl('')
        setStreamStats({})
        setRunTiming(null)
        setRunStartedAt(null)
        setActiveUrl('')
        setCapacity(null)
        pushEvent('Sandbox reset.')
    }, [pushEvent, runIsActive])
    return { selectSandboxTab, extendRun, stopRun, resetRun }
}
