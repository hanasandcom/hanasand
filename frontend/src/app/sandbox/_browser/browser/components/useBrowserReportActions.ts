'use client'

import { useCallback, useEffect, type Dispatch, type SetStateAction, type MutableRefObject } from 'react'
import type { BrowserRunHistory, Capture, SandboxCapacity, SandboxProfile, SessionState, SocketState, StreamStats } from '../types'
import { historyApiPath } from '../browserSetup'
import { getOrCreateBrowserClientId } from '../browserClientId'
import { persistHistory } from '../historyData'
import { buildExportReport } from '../browserExport'
import { buildAnalystSummary } from '../browserAnalystSummary'

type BrowserReportActionsOptions = {
    target: string; activeUrl: string; sessionState: SessionState; socketState: SocketState; selectedProfile: SandboxProfile; summary: ReturnType<typeof buildAnalystSummary>; captures: Capture[]; events: string[]; consoleEvents: string[]; providerConsoleEvents: string[]; capacity: SandboxCapacity | null; streamStats: StreamStats; metricEvent: string; currentRunId: string
    setHistory: Dispatch<SetStateAction<BrowserRunHistory[]>>; setShareStatus: Dispatch<SetStateAction<string>>; setShareUrl: Dispatch<SetStateAction<string>>; setShareError: Dispatch<SetStateAction<string>>; stoppedEarlyRef: MutableRefObject<boolean>
}

export function useBrowserReportActions(options: BrowserReportActionsOptions) {
    const { target, activeUrl, sessionState, socketState, selectedProfile, summary, captures, events, consoleEvents, providerConsoleEvents, capacity, streamStats, metricEvent, currentRunId, setHistory, setShareStatus, setShareUrl, setShareError, stoppedEarlyRef } = options
    const buildReport = useCallback(() => buildExportReport({ target, activeUrl, sessionState, socketState, profile: selectedProfile, summary, captures, events, consoleEvents, providerConsoleEvents, capacity, streamStats, metricEvent }), [target, activeUrl, sessionState, socketState, selectedProfile, summary, captures, events, consoleEvents, providerConsoleEvents, capacity, streamStats, metricEvent])
    const exportReport = useCallback(() => {
        const blob = new Blob([JSON.stringify(buildReport(), null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `browser-sandbox-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
        link.click()
        URL.revokeObjectURL(url)
    }, [buildReport])

    const saveReport = useCallback(async (automatic = false) => {
        if (!currentRunId || !captures.length) return
        const savedStatus = sessionState === 'ended' ? stoppedEarlyRef.current ? 'cancelled' : 'completed' : sessionState
        if (!automatic) {
            setShareStatus('saving')
            setShareError('')
            setShareUrl('')
        }
        try {
            const response = await fetch(`${historyApiPath}/${encodeURIComponent(currentRunId)}/report`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: getOrCreateBrowserClientId(),
                    report: buildReport(),
                }),
            })
            const payload = await response.json() as { reportUrl?: string; resultId?: string; error?: string }
            if (!response.ok) throw new Error(payload.error || 'Could not save the report. Try again.')
            if (!payload.reportUrl) throw new Error('The report link was not returned. Try again.')
            const reportUrl = new URL(payload.reportUrl, window.location.origin).toString()
            if (!automatic) setShareUrl(reportUrl)
            setHistory(current => persistHistory(current.map(run => run.id === currentRunId ? { ...run, reportUrl, resultId: payload.resultId || run.resultId, status: savedStatus } : run)))
            if (automatic) return
            setShareStatus('saved')
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(reportUrl)
                    setShareStatus('copied')
                }
            } catch {
            // The selectable link remains available when mobile clipboard access is denied.
            }
        } catch (error) {
            if (automatic) return
            setShareStatus('failed')
            setShareError(error instanceof Error ? error.message : 'Could not save the report. Try again.')
        }
    }, [buildReport, captures, currentRunId, sessionState, setHistory, setShareError, setShareStatus, setShareUrl, stoppedEarlyRef])

    useEffect(() => {
        if (sessionState !== 'ended' || !currentRunId || !captures.length) return
        const timer = window.setTimeout(() => { void saveReport(true) }, 250)
        return () => window.clearTimeout(timer)
    }, [sessionState, currentRunId, captures.length, saveReport])

    return { exportReport, saveReport }
}
