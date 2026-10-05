'use client'

import { History, LoaderCircle, MoreHorizontal, Share2, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

type ProviderResult = { status: 'clean' | 'suspicious' | 'blocked' | 'loading'; label: string }
type HistoryRun = {
    id: string
    resultId: string
    target: string
    network: 'regular' | 'tor'
    startedAt: string
    status: string
    providerResults?: Record<string, ProviderResult>
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
        const resultResponse = await fetch(`/api/backend/browser/results/${encodeURIComponent(run.resultId)}?clientId=${encodeURIComponent(clientId)}&run=${encodeURIComponent(run.id)}`, { credentials: 'include' })
        const report = await resultResponse.json()
        if (!resultResponse.ok) throw new Error(report?.error || 'Could not load this finding.')
        const response = await fetch(`/api/backend/browser/runs/${encodeURIComponent(run.id)}/report`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, report }),
        })
        const payload = await response.json() as { reportUrl?: string; error?: string }
        if (!response.ok || !payload.reportUrl) throw new Error(payload.error || 'Could not create a share link.')
        const url = new URL(payload.reportUrl, window.location.origin).toString()
        if (typeof navigator.share === 'function') {
            await navigator.share({ title: `Sandbox finding: ${run.target}`, url })
            return 'Finding shared.'
        }
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(url)
            return 'Share link copied.'
        }
        window.prompt('Copy this finding link', url)
        return 'Share link ready.'
    }

    const deleteRun = async (run: HistoryRun) => {
        setBusyId(run.id)
        setMessage('')
        setError('')
        try {
            const response = await fetch('/api/backend/browser/runs', {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, ids: [run.id] }),
            })
            const payload = await response.json() as { error?: string }
            if (!response.ok) throw new Error(payload.error || 'Could not delete this run.')
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
            setError(cause instanceof Error ? cause.message : 'Could not share this finding.')
        } finally {
            setBusyId('')
        }
    }

    return <>
        <button type='button' onClick={() => {
            dialog.current?.showModal()
            if (!runs.length || Date.now() - lastLoadedAt.current > 30_000) void load(0)
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
                    <button type='button' disabled={Boolean(busyId)} onClick={() => void shareRun(run)} className='grid h-8 w-8 shrink-0 place-items-center rounded text-ui-muted hover:text-ui-text disabled:opacity-50' aria-label={`Share finding for ${run.target}`} title='Share finding'>
                        {busyId === run.id ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Share2 className='h-4 w-4' />}
                    </button>
                    <div className='relative shrink-0'>
                        <button type='button' disabled={Boolean(busyId)} onClick={() => setOpenMenuId(current => current === run.id ? '' : run.id)} className='grid h-8 w-8 place-items-center rounded text-ui-muted hover:text-ui-text disabled:opacity-50' aria-label={`More options for ${run.target}`} aria-expanded={openMenuId === run.id} title='More options'>
                            <MoreHorizontal className='h-4 w-4' />
                        </button>
                        {openMenuId === run.id ? <div className='absolute right-0 top-9 z-20 min-w-28 rounded-md border border-ui-border bg-ui-panel p-1 shadow-lg'>
                            <button type='button' onClick={() => void deleteRun(run)} className='flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ui-text hover:bg-ui-raised'>
                                <Trash2 className='h-3.5 w-3.5' />Delete
                            </button>
                        </div> : null}
                    </div>
                </article>)}
                {!loading && !error && !runs.length ? <p className='text-sm text-ui-muted'>No previous runs.</p> : null}
                {loading && !runs.length ? <p role='status' className='text-sm text-ui-muted'>Loading…</p> : null}
                <div ref={loadMoreTarget} aria-hidden='true' />
                {loading && runs.length ? <p role='status' className='py-2 text-center text-xs text-ui-muted'>Loading…</p> : null}
            </div>
        </dialog>
    </>
}

function ProviderBadges({ results }: { results?: Record<string, ProviderResult> }) {
    return <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
        <ProviderBadge provider='virustotal' result={results?.virustotal} />
        <ProviderBadge provider='urlquery' result={results?.urlquery} />
    </span>
}

function ProviderBadge({ provider, result }: { provider: 'virustotal' | 'urlquery'; result?: ProviderResult }) {
    const name = provider === 'virustotal' ? 'VirusTotal' : 'urlquery'
    const rawText = (result?.label || '').replace(/\b(?:virustotal|VT|urlquery)\b:?/gi, '').replace(/\s*alerts?$/i, '').trim()
    const text = !rawText || rawText === '—' ? '0' : rawText
    const clean = !result || result.status === 'clean' || text === '0'
    const description = `${name}: ${text}${provider === 'urlquery' && /^\d+$/.test(text) ? ' alerts' : ''}`
    return <span role='img' title={description} aria-label={description} className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold ${clean ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-warning/40 bg-ui-warning/10 text-ui-warning'}`}>
        <Image src={`/logos/${provider}.${provider === 'virustotal' ? 'svg' : 'png'}`} alt='' width={16} height={16} unoptimized className='h-4 w-4 shrink-0 object-contain' />
        <span aria-hidden='true'>{text}</span>
    </span>
}
