'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { fetchPage, cell, displayCell } from './databaseInventoryHelpers'
import type { Item, Page } from './databaseInventoryTypes'
import { copyTextToClipboard } from '@/utils/copyTextToClipboard'

export default function DatabaseRowPreview({ instance, database, item }: { instance: string, database: string, item: Item }) {
    const [rows, setRows] = useState<Record<string, unknown>[]>([])
    const [fields, setFields] = useState(item.columns || [])
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)
    const [totalRows, setTotalRows] = useState<number | null>(null)
    const [busy, setBusy] = useState(true)
    const [copyStatus, setCopyStatus] = useState<{ key: string, result: 'copied' | 'failed' } | null>(null)
    const copyTimer = useRef<number | null>(null)
    const sentinel = useRef<HTMLDivElement>(null)
    const viewport = useRef<HTMLDivElement>(null)
    const consume = useRef<() => void>(() => {})
    useEffect(() => {
        const controller = new AbortController()
        let loading = false, finished = false, nextCursor: string | null = null
        // Count independently so large tables cannot delay or break row loading.
        void fetchPage(new URLSearchParams({ instance, database, mode: 'count', schema: item.schema, table: item.name }), controller.signal)
            .then(page => { if (!controller.signal.aborted) setTotalRows(page.totalRows ?? null) })
            .catch(() => {})
        const request = (cursor: string | null) => {
            const params = new URLSearchParams({ instance, database, mode: 'rows', schema: item.schema, table: item.name })
            if (cursor) params.set('cursor', cursor)
            return fetchPage(params, controller.signal)
        }
        // One five-row page ahead keeps scrolling independent of network latency.
        let next: Promise<Page> | null = request(null)
        void next.catch(() => {})
        consume.current = () => {
            if (loading || finished || controller.signal.aborted) return
            loading = true; setBusy(true); setError('')
            const page = next || request(nextCursor)
            next = null
            void page.then(result => {
                if (controller.signal.aborted) return
                setRows(previous => [...previous, ...(result.rows || [])])
                setFields(previous => [...new Set([...previous, ...(result.fields || [])])])
                nextCursor = result.nextCursor
                finished = !nextCursor; setDone(finished)
                if (!finished) { next = request(nextCursor); void next.catch(() => {}) }
            }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) }).finally(() => { loading = false; if (!controller.signal.aborted) setBusy(false) })
        }
        consume.current()
        return () => controller.abort()
    }, [instance, database, item.schema, item.name])
    useEffect(() => {
        if (busy || done || error || !sentinel.current) return
        const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) consume.current() }, { root: viewport.current, rootMargin: '80px' })
        observer.observe(sentinel.current)
        return () => observer.disconnect()
    }, [busy, done, error, rows])
    useEffect(() => () => { if (copyTimer.current !== null) window.clearTimeout(copyTimer.current) }, [])
    async function copyCell(key: string, value: string) {
        const result = await copyTextToClipboard(value) ? 'copied' : 'failed'
        setCopyStatus({ key, result })
        if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
        copyTimer.current = window.setTimeout(() => setCopyStatus(null), 1600)
    }
    const total = done ? rows.length : totalRows === null ? null : Math.max(rows.length, totalRows)
    return <div className='min-w-0'>
        <div ref={viewport} className='min-w-0 max-w-full max-h-80 overflow-auto rounded border border-ui-border' tabIndex={0} aria-label={`${item.name} rows`}>
            <table className='min-w-full text-left text-xs'><thead className='sticky top-0 bg-ui-raised text-ui-muted'><tr>{fields.map(field => <th key={field} className='whitespace-nowrap px-3 py-2 font-medium'>{field}</th>)}</tr></thead><tbody className='divide-y divide-ui-border'>
                {rows.map((row, index) => <tr key={index}>{fields.map(field => {
                    const key = `${index}:${field}`
                    const fullValue = cell(row[field])
                    const value = displayCell(field, fullValue)
                    const status = copyStatus?.key === key ? copyStatus.result : null
                    return <td key={field} className='align-top'><button type='button' onClick={() => void copyCell(key, fullValue)} aria-label={`${status === 'copied' ? 'Copied' : 'Copy'} ${field} value`} title={status === 'failed' ? 'Copy failed' : 'Click to copy · Scroll to see full value'} className='flex w-full min-w-0 items-center gap-1.5 px-3 py-2 text-left font-mono'><span className='noscroll block w-[6ch] shrink-0 overflow-x-auto whitespace-nowrap'>{value}</span>{status === 'copied' ? <Check aria-hidden className='h-3.5 w-3.5 shrink-0 text-ui-success' /> : <Copy aria-hidden className='h-3.5 w-3.5 shrink-0 text-ui-muted' />}<span className='sr-only' aria-live='polite'>{status === 'copied' ? `${field} copied` : status === 'failed' ? `${field} copy failed` : ''}</span></button></td>
                })}</tr>)}
            </tbody></table>
            <div ref={sentinel} className='h-px' />
        </div>
        {busy && <p role='status' className='mt-2 text-xs text-ui-muted'>Loading rows…</p>}
        {error && <p role='alert' className='mt-2 text-xs text-ui-warning'>{error} <button type='button' onClick={() => consume.current()} className='underline'>Retry</button></p>}
        {(rows.length > 0 || done) && <p className='mt-2 text-xs text-ui-muted'>{rows.length}/{total ?? '…'} {total === 1 ? 'row' : 'rows'}</p>}
    </div>
}
