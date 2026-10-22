'use client'

import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import type { BrowserQuota, BrowserRunHistory, BrowserRunStats } from '../types'
import { browserApiBase, historyStorageKey, statsStorageKey } from '../browserSetup'
import { getOrCreateBrowserClientId } from '../browserClientId'
import { deleteBrowserHistory } from '../historyDeletion'
import { persistHistory, sanitizeHistory } from '../historyData'
import { quotaValue } from '../browserValues'
import { shareSavedFinding } from '../shareSavedFinding'
import { fetchRecentBrowserHistory } from '../historyApi'

type BrowserHistoryActionsOptions = {
    initialStats: BrowserRunStats | null; history: BrowserRunHistory[]; setHistory: Dispatch<SetStateAction<BrowserRunHistory[]>>; setHistoryReady: Dispatch<SetStateAction<boolean>>; setQuota: Dispatch<SetStateAction<BrowserQuota | null>>; setRunStats: Dispatch<SetStateAction<BrowserRunStats | null>>
}

export function useBrowserHistoryActions({ initialStats, history, setHistory, setHistoryReady, setQuota, setRunStats }: BrowserHistoryActionsOptions) {
    const refreshHistory = useCallback(async () => {
        const clientId = getOrCreateBrowserClientId()
        const payload = await fetchRecentBrowserHistory(clientId)
        setHistory(persistHistory(sanitizeHistory(payload.runs)))
        setQuota(quotaValue(payload.quota))
    }, [])

    const refreshRunStats = useCallback(async () => {
        const response = await fetch(`${browserApiBase}/browser/stats`, { cache: 'no-store' })
        if (!response.ok) return
        const value = await response.json() as Partial<BrowserRunStats>
        if (Number.isFinite(value.runs24h) && Number.isFinite(value.darkwebRuns24h)) {
            const stats = { runs24h: Number(value.runs24h), darkwebRuns24h: Number(value.darkwebRuns24h) }
            setRunStats(stats)
            try {
                window.localStorage.setItem(statsStorageKey, JSON.stringify({ stats, cachedAt: Date.now() }))
            } catch {
            // The live response remains usable when browser storage is unavailable.
            }
        }
    }, [])

    const deleteHistory = useCallback(async (ids?: string[]) => {
        await deleteBrowserHistory(getOrCreateBrowserClientId(), ids, 'Could not delete browser history.')
        await refreshHistory()
    }, [refreshHistory])

    const shareFinding = useCallback(shareSavedFinding, [])
    useEffect(() => {
        void refreshHistory().then(() => setHistoryReady(true)).catch(() => setHistoryReady(true))
    }, [refreshHistory])

    useEffect(() => {
        if (!initialStats) {
            try {
                const cached = JSON.parse(window.localStorage.getItem(statsStorageKey) || 'null') as { stats?: BrowserRunStats; cachedAt?: number } | null
                if (cached?.stats && Number.isFinite(cached.cachedAt) && Date.now() - Number(cached.cachedAt) < 60_000
                && Number.isFinite(cached.stats.runs24h) && Number.isFinite(cached.stats.darkwebRuns24h)) {
                    setRunStats(cached.stats)
                }
            } catch {
            // A missing or outdated cache must not block a fresh stats request.
            }
        }
        void refreshRunStats().catch(() => undefined)
        const timer = window.setInterval(() => { void refreshRunStats() }, 30_000)
        return () => window.clearInterval(timer)
    }, [initialStats, refreshRunStats])

    useEffect(() => {
        getOrCreateBrowserClientId()
        try {
            const savedHistory = window.localStorage.getItem(historyStorageKey)
            if (savedHistory) {
                const stored = JSON.parse(savedHistory)
                if (Array.isArray(stored)) {
                    if (!history.length) setHistory(sanitizeHistory(stored))
                    setHistoryReady(true)
                }
            }
        } catch {
        // The history request marks the view ready when storage is unavailable.
        }
    }, [history.length])
    return { refreshHistory, refreshRunStats, deleteHistory, shareFinding }
}
