'use client'

import { useRef, useState, type ReactNode } from 'react'
import { ChartNoAxesCombined, Check, ChevronDown, Download, Minus, X } from 'lucide-react'
import BrowserRunMetrics, { type RunMetrics } from '../BrowserRunMetrics'

export type NetworkRequestRow = {
    url?: string
    method?: string
    status?: number
    failure?: string
    host?: string
    mimeType?: string
    durationMs?: number
    initiator?: string
    ip?: string
    asn?: string
    port?: number
    protocol?: string
    tlsSubject?: string
    tlsIssuer?: string
    tlsValidFrom?: number
    tlsValidTo?: number
    at?: string
}

export function ReportPanel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <details className='min-w-0 rounded-lg border border-ui-border bg-ui-panel'>
            <summary className='cursor-pointer p-4 text-sm font-semibold text-ui-primary'>{title}</summary>
            <div className='border-t border-ui-border p-4'>{children}</div>
        </details>
    )
}

export function ReportList({ items, empty }: { items: string[]; empty: string }) {
    const rows = items.map(item => item.trim()).filter(Boolean)
    if (!rows.length) return <p className='text-sm text-ui-muted'>{empty}</p>
    return <ul className='grid gap-2 text-sm text-ui-muted'>{rows.map(item => <li key={item} className='rounded-md border border-ui-border bg-ui-raised px-3 py-2'>{item}</li>)}</ul>
}

export function ReportStatistics({ metrics }: { metrics: RunMetrics }) {
    const dialog = useRef<HTMLDialogElement>(null)
    return <>
        <button type='button' aria-label='Statistics' title='Statistics' onClick={() => dialog.current?.showModal()} className='rounded-md border border-ui-border p-2 text-ui-text hover:border-ui-primary'><ChartNoAxesCombined className='h-5 w-5' /></button>
        <dialog ref={dialog} aria-labelledby='report-statistics-title' onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }} className='fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-lg border border-ui-border bg-ui-panel p-5 text-ui-text shadow-xl backdrop:bg-ui-backdrop'>
            <div className='mb-4 flex items-center justify-between gap-4'>
                <h2 id='report-statistics-title' className='text-lg font-semibold'>Statistics</h2>
                <button type='button' aria-label='Close statistics' onClick={() => dialog.current?.close()} className='rounded-md p-1 hover:bg-ui-raised'><X className='h-5 w-5' /></button>
            </div>
            <BrowserRunMetrics metrics={metrics} />
        </dialog>
    </>
}

export function ReportExport({ report, markdown }: { report: object; markdown: string }) {
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    async function download(format: 'markdown' | 'json' | 'pdf') {
        setBusy(true)
        setError('')
        try {
            if (format === 'pdf') {
                const { exportReportPdf } = await import('./reportPdf')
                await exportReportPdf(markdown)
            } else {
                const content = format === 'json' ? JSON.stringify({ schemaVersion: 1, ...report }, null, 2) : markdown
                const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' }))
                const link = document.createElement('a')
                link.href = url
                link.download = `browser-report.${format === 'json' ? 'json' : 'md'}`
                link.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
            }
            setOpen(false)
        } catch {
            setError('Could not export the report. Try again.')
        } finally {
            setBusy(false)
        }
    }

    return <div className='relative'>
        <button type='button' aria-expanded={open} disabled={busy} onClick={() => setOpen(value => !value)} className='flex items-center gap-2 ui-button ui-button-secondary px-3 py-2 text-sm'><Download className='h-4 w-4' />Export<ChevronDown className='h-4 w-4' /></button>
        {open ? <div aria-label='Export formats' className='absolute right-0 z-20 mt-1 grid min-w-36 rounded-md border border-ui-border bg-ui-panel p-1 shadow-lg' onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>{(['markdown', 'json', 'pdf'] as const).map(format => <button key={format} type='button' disabled={busy} onClick={() => void download(format)} className='rounded px-3 py-2 text-left text-sm hover:bg-ui-raised'>{format === 'markdown' ? 'Markdown' : format.toUpperCase()}</button>)}</div> : null}
        {error ? <p role='alert' className='mt-2 text-xs text-ui-text'>{error}</p> : null}
    </div>
}

export function networkRows(requests: NetworkRequestRow[], urls: string[]) {
    const rows = new Map<string, NetworkRequestRow & { observed: boolean }>()
    for (const request of requests) {
        if (!request.url) continue
        const key = `${request.method || 'GET'} ${request.url}`
        const previous = rows.get(key)
        rows.set(key, { ...previous, ...Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined && value !== null)), observed: true, ...(request.status ? { failure: request.failure } : {}) })
    }
    const observed = new Set([...rows.values()].map(row => row.url))
    for (const url of new Set(urls)) if (url && !observed.has(url)) rows.set(`extracted ${url}`, { url, observed: false })
    return [...rows.values()]
}

export function NetworkTable({ requests, urls, complete }: { requests: NetworkRequestRow[]; urls: string[]; complete: boolean }) {
    const rows = networkRows(requests, urls)
    if (!rows.length) return <p className='text-sm text-ui-muted'>No network activity saved.</p>
    return <div className='max-h-[36rem] overflow-auto overscroll-contain rounded-md border border-ui-border'>
        <table className='w-full min-w-[52rem] border-collapse text-left text-xs'>
            <caption className='sr-only'>Network requests and extracted URLs</caption>
            <thead className='sticky top-0 bg-ui-raised text-ui-muted'><tr>{['Certificate', 'URL', 'Method', 'Status', 'IP', 'MIME', 'Time', 'Signer'].map(label => <th key={label} scope='col' className='border-b border-ui-border px-2 py-2'>{label}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={index} className='border-b border-ui-border/60 align-top'>
                <td className='p-2'>{row.tlsIssuer || row.tlsSubject ? <span title={`Certificate captured; trust validation not recorded. Subject: ${row.tlsSubject || 'Unknown'}. Issuer: ${row.tlsIssuer || 'Unknown'}.${row.tlsValidTo ? ` Expires: ${new Date(row.tlsValidTo * 1000).toISOString()}.` : ''}`}><Check className='h-4 w-4 text-ui-success' aria-label='Certificate captured' /></span> : <Minus className='h-4 w-4 text-ui-muted' aria-label='No certificate captured' />}</td>
                <td className='max-w-lg break-all p-2 font-mono'>{row.url}</td>
                <td className='p-2'>{row.observed ? row.method || 'GET' : ''}</td>
                <td className={`p-2 ${row.failure ? 'text-ui-warning' : 'text-ui-muted'}`}>{row.observed ? row.failure || row.status || 'Requested' : complete ? 'Not contacted' : 'No captured request'}</td>
                <td className='p-2 font-mono'>{row.ip}</td><td className='max-w-32 break-all p-2'>{row.mimeType}</td>
                <td className='whitespace-nowrap p-2'>{row.durationMs !== undefined ? `${Math.round(row.durationMs)}ms` : ''}</td><td className='max-w-48 wrap-break-word p-2'>{row.tlsIssuer}</td>
            </tr>)}</tbody>
        </table>
    </div>
}
