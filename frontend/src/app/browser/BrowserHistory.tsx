'use client'

import { History, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ProviderBadges } from './components/ProviderBadges'
import { RunHistoryActions } from './components/RunHistoryPanel'
import { shareSavedFinding } from './shareSavedFinding'
import { deleteBrowserHistory } from './historyDeletion'
import type { ProviderRunResult } from './types/history'

type HistoryRun = {
    id: string
    resultId: string
    target: string
    network: 'regular' | 'tor'
    startedAt: string
    status: string
    providerResults?: Record<string, ProviderRunResult>
}

export default function BrowserHistory({ clientId, onShare }: { clientId: string; onShare?: (run: HistoryRun) => Promise<string> }) {
    const dialog = useRef<HTMLDialogElement>(null)
    const loadMoreTarget = useRef<HTMLDivElement>(null)
    const request = useRef<AbortController | null>(null)
    const loadingRef = useRef(false)
    const lastLoadedAt = useRef(0)
    const [runs, setRuns] = useState<HistoryRun[]>([])
    const [nextOffset, setNextOffset] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [busyId, setBusyId] = useState('')
    const [openMenuId, setOpenMenuId] = useState('')

    useEffect(() => () => request.current?.abort(), [])

    const load = useCallback(async (offset = 0) => {
        if (loadingRef.current) return
        loadingRef.current = true
        const controller = new AbortController()
        request.current = controller
        setLoading(true)
        setError('')
        try {
            const response = await fetch(`/api/backend/browser/runs?history=all&offset=${offset}&clientId=${encodeURIComponent(clientId)}`, { credentials: 'include', signal: controller.signal })
            if (!response.ok) throw new Error('Could not load history.')
            const data = await response.json() as { runs: HistoryRun[]; nextOffset?: number | null }
            setRuns(current => offset === 0 ? data.runs : [...current, ...data.runs.filter(run => !current.some(item => item.id === run.id))])
            setNextOffset(data.nextOffset ?? null)
            if (offset === 0) lastLoadedAt.current = Date.now()
        } catch (cause) {
            if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load history.')
        } finally {
            if (request.current === controller) {
                request.current = null
                loadingRef.current = false
                setLoading(false)
            }
        }
    }, [clientId])

    useEffect(() => {
        if (nextOffset === null || loading || error || !dialog.current?.open || !loadMoreTarget.current) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) void load(nextOffset)
        }, { root: dialog.current, rootMargin: '240px' })
        observer.observe(loadMoreTarget.current)
        return () => observer.disconnect()
    }, [error, load, loading, nextOffset])

    const share = async (run: HistoryRun) => {
        if (onShare) return onShare(run)
        return shareSavedFinding(run)
    }

    const deleteRun = async (run: HistoryRun) => {
        setBusyId(run.id)
        setMessage('')
        setError('')
        try {
            await deleteBrowserHistory(clientId, [run.id], 'Could not delete this run.')
            setRuns(current => current.filter(item => item.resultId !== run.resultId))
            setMessage('Run deleted.')
            setOpenMenuId('')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not delete this run.')
        } finally {
            setBusyId('')
        }
    }

    const shareRun = async (run: HistoryRun) => {
        setBusyId(run.id)
        setMessage('')
        setError('')
        try {
            setMessage(await share(run))
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : 'Could not share this finding.')
        } finally {
            setBusyId('')
        }
    }

    return <>
        <button type='button' onClick={() => {
            dialog.current?.showModal()
            if (!lastLoadedAt.current || Date.now() - lastLoadedAt.current > 30_000) void load(0)
        }} disabled={!clientId} className='inline-flex items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-4 py-2 text-sm font-semibold text-ui-text hover:border-ui-primary' aria-haspopup='dialog'>
            <History className='h-4 w-4' />History
        </button>
        <dialog ref={dialog} aria-labelledby='browser-history-title' onClose={() => {
            request.current?.abort()
            request.current = null
            loadingRef.current = false
            setLoading(false)
        }} className='m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-lg border border-ui-border bg-ui-panel p-4 text-ui-text shadow-xl backdrop:bg-ui-backdrop'>
            <div className='mb-4 flex items-center justify-between gap-4'>
                <h2 id='browser-history-title' className='text-lg font-semibold'>History</h2>
                <button type='button' onClick={() => dialog.current?.close()} aria-label='Close history' className='rounded-md p-2 hover:bg-ui-raised'><X className='h-5 w-5' /></button>
            </div>
            {message ? <p role='status' className='mb-2 text-xs text-ui-muted'>{message}</p> : null}
            {error ? <div role='alert' className='mb-2 text-sm text-ui-text'>{error} <button type='button' onClick={() => void load(runs.length ? nextOffset ?? 0 : 0)} className='underline'>Try again</button></div> : null}
            <div className='grid gap-2'>
                {runs.map(run => <article key={run.id} className='relative flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-ui-border bg-ui-raised p-3 text-sm transition hover:border-ui-primary sm:flex-nowrap'>
                    <Link href={`/sandbox/${run.resultId}?run=${encodeURIComponent(run.id)}`} onClick={() => dialog.current?.close()} className='grid min-w-0 flex-1 gap-2 focus-visible:outline-2 focus-visible:outline-ui-primary sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center'>
                        <span className='min-w-0 truncate font-mono text-ui-text'>{run.target}</span>
                        <ProviderBadges results={run.providerResults} />
                        <span className='whitespace-nowrap text-xs text-ui-muted'>{new Date(run.startedAt).toLocaleString()}</span>
                    </Link>
                    <RunHistoryActions
                        density='dialog'
                        target={run.target}
                        disabled={Boolean(busyId)}
                        sharing={busyId === run.id}
                        menuOpen={openMenuId === run.id}
                        onShare={() => { void shareRun(run) }}
                        onToggleMenu={() => setOpenMenuId(current => current === run.id ? '' : run.id)}
                        onDelete={() => { void deleteRun(run) }}
                    />
                </article>)}
                {!loading && !error && !runs.length ? <p className='text-sm text-ui-muted'>No previous runs.</p> : null}
                {loading && !runs.length ? <p role='status' className='text-sm text-ui-muted'>Loading…</p> : null}
                <div ref={loadMoreTarget} aria-hidden='true' />
                {loading && runs.length ? <p role='status' className='py-2 text-center text-xs text-ui-muted'>Loading…</p> : null}
            </div>
        </dialog>
    </>
}
