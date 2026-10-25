'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { UvmDashboard, UvmImageReport, UvmImageScanHistoryEntry, UvmImageScanHistoryPage, UvmImageScanRun } from '@/utils/monitoring/types'
import { formatOsloShortDateTime } from '@/utils/date/formatOsloShortDateTime'
import ImageCard from '@/components/monitoring/vulnerabilities/imageCard'

type Props = {
    data: UvmDashboard
    servicesPaused: boolean
    getReport: () => Promise<UvmImageReport>
    runScan: () => Promise<{ queued: boolean, started: boolean, jobId: string | null, report: UvmImageReport }>
    getHistory: (cursor: string | null) => Promise<UvmImageScanHistoryPage>
    getHistoryRun: (runId: string) => Promise<{ run: UvmImageScanRun }>
}

export default function UvmPanelImages({ data, servicesPaused, getReport, runScan, getHistory, getHistoryRun }: Props) {
    const [report, setReport] = useState<UvmImageReport | null>(null)
    const [runs, setRuns] = useState<UvmImageScanHistoryEntry[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [expandedImages, setExpandedImages] = useState<string[]>([])
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [selectedRun, setSelectedRun] = useState<UvmImageScanRun | null>(null)
    const [loadingRunId, setLoadingRunId] = useState<string | null>(null)
    const [selectedRunError, setSelectedRunError] = useState('')
    const [loading, setLoading] = useState(true)
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [busy, setBusy] = useState(false)
    const [reportError, setReportError] = useState('')
    const [historyError, setHistoryError] = useState('')
    const [message, setMessage] = useState('')
    const wasRunning = useRef(false)
    const selectedRunRequest = useRef<string | null>(null)

    const loadHistory = useCallback(async (cursor: string | null = null, append = false) => {
        setLoadingHistory(true)
        setHistoryError('')
        try {
            const page = await getHistory(cursor)
            setRuns(current => append ? mergeRuns(current, page.runs) : page.runs)
            setNextCursor(page.nextCursor)
        } catch (error) {
            setHistoryError(error instanceof Error ? error.message : 'Image scan history is unavailable.')
        } finally {
            setLoadingHistory(false)
        }
    }, [getHistory])

    const loadReport = useCallback(async () => {
        try {
            const next = await getReport()
            setReport(next)
            setReportError('')
            if (wasRunning.current && !next.scanStatus.isRunning) void loadHistory(null)
            wasRunning.current = next.scanStatus.isRunning
        } catch (error) {
            setReportError(error instanceof Error ? error.message : 'Image report is unavailable.')
        } finally {
            setLoading(false)
        }
    }, [getReport, loadHistory])

    const refresh = useCallback(async () => {
        await Promise.all([loadReport(), loadHistory(null)])
    }, [loadHistory, loadReport])

    useEffect(() => { void refresh() }, [refresh])
    useEffect(() => {
        if (!report?.scanStatus.isRunning) return
        const timer = setInterval(() => { void loadReport() }, 5000)
        return () => clearInterval(timer)
    }, [loadReport, report?.scanStatus.isRunning])

    const imageWorker = data.imageWorker
    const executionEnabled = report?.execution.enabled === true
    const workerReady = imageWorker?.status === 'available'
    const canRun = !servicesPaused && executionEnabled && workerReady && !report?.scanStatus.isRunning && !busy
    const runLabel = busy ? 'Queueing…'
        : report?.scanStatus.isRunning ? 'Scan running'
            : servicesPaused || (report && !executionEnabled) ? 'Paused'
                : !workerReady ? 'Worker unavailable'
                    : 'Run image scan'
    const findingsCount = report?.images.reduce((total, image) => total + image.totalVulnerabilities, 0) ?? 0
    const displayedImageCount = selectedRun?.imageCount ?? report?.imageCount ?? 0
    const displayedFindingsCount = selectedRun
        ? selectedRun.images.reduce((total, image) => total + image.totalVulnerabilities, 0)
        : findingsCount

    async function startScan() {
        if (!canRun) return
        setBusy(true)
        setMessage('')
        setReportError('')
        selectedRunRequest.current = null
        setSelectedRunId(null)
        setSelectedRun(null)
        setSelectedRunError('')
        try {
            const result = await runScan()
            setReport(result.report)
            wasRunning.current = result.report.scanStatus.isRunning
            setMessage(result.queued ? 'Image scan queued.' : 'Image scan request accepted.')
            await loadHistory(null)
        } catch (error) {
            setReportError(error instanceof Error ? error.message : 'Image scan could not be queued.')
        } finally {
            setBusy(false)
        }
    }

    function toggleImage(image: string) {
        setExpandedImages(current => current.includes(image) ? current.filter(item => item !== image) : [...current, image])
    }

    async function selectRun(runId: string) {
        setSelectedRunId(runId)
        setSelectedRun(null)
        setLoadingRunId(runId)
        setSelectedRunError('')
        selectedRunRequest.current = runId
        try {
            const result = await getHistoryRun(runId)
            if (selectedRunRequest.current === runId) setSelectedRun(result.run)
        } catch (error) {
            if (selectedRunRequest.current === runId) setSelectedRunError(error instanceof Error ? error.message : 'The selected image scan is unavailable.')
        } finally {
            if (selectedRunRequest.current === runId) setLoadingRunId(null)
        }
    }

    function showLatest() {
        selectedRunRequest.current = null
        setSelectedRunId(null)
        setSelectedRun(null)
        setLoadingRunId(null)
        setSelectedRunError('')
    }

    return <div className='grid gap-4'>
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h2 className='text-lg font-semibold'>Container images</h2>
                    <p className='mt-1 text-xs text-ui-muted'>{selectedRun || report ? `${displayedImageCount} images · ${displayedFindingsCount} findings` : loading ? 'Loading image results…' : 'Image results unavailable'}</p>
                </div>
                <button type='button' onClick={() => void startScan()} disabled={!canRun} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{runLabel}</button>
            </div>
            <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ui-muted'>
                <span>Execution: {servicesPaused || report?.execution.state === 'paused' ? 'stopped' : executionEnabled ? 'enabled' : loading ? 'loading' : 'unavailable'}</span>
                <span>Worker: {servicesPaused ? 'stopped' : imageWorker?.status === 'available' ? 'ready' : imageWorker?.status === 'unavailable' ? 'unavailable' : 'status unavailable'}</span>
                <span>Last scan: {safeDate(report?.scanStatus.finishedAt || report?.generatedAt)}</span>
                {report?.scanStatus.isRunning && <span className='font-semibold text-ui-warning'>{report.scanStatus.completedImages}/{report.scanStatus.totalImages ?? report.scanStatus.targetCount} targets complete</span>}
            </div>
            {servicesPaused && <p role='status' className='mt-3 text-sm text-ui-warning'>Image services are stopped pending disk expansion. Existing results are shown when the API is reachable.</p>}
            {!servicesPaused && report && !executionEnabled && <p role='status' className='mt-3 text-sm text-ui-warning'>{report.execution.reason === 'pending_disk_expansion' ? 'Image scanning is paused pending disk expansion.' : 'Image scanning is paused.'}</p>}
            {!servicesPaused && executionEnabled && !workerReady && <p role='status' className='mt-3 text-sm text-ui-warning'>{imageWorker?.reason || 'Image worker readiness is unavailable.'}</p>}
            {message && <p role='status' className='mt-3 text-sm text-ui-primary'>{message}</p>}
            {reportError && <p role='status' className='mt-3 text-sm text-ui-warning'>Image report unavailable: {reportError}</p>}
        </section>

        <section className='grid gap-2'>
            <div className='flex flex-wrap items-center justify-between gap-3'><h3 className='text-base font-semibold'>{selectedRun ? `Run findings · ${safeDate(selectedRun.startedAt)}` : selectedRunId ? 'Selected run findings' : 'Current findings'}</h3><div className='flex gap-2'>{selectedRunId && <button type='button' onClick={showLatest} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Show latest</button>}<button type='button' onClick={() => void refresh()} disabled={loading} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
            {selectedRunError && <p role='status' className='rounded-md border border-ui-border bg-ui-panel p-4 text-sm text-ui-warning'>Selected run unavailable: {selectedRunError}</p>}
            {loadingRunId === selectedRunId && selectedRunId && <p className='rounded-md border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>Loading stored findings…</p>}
            {selectedRun && selectedRun.images.length ? selectedRun.images.map(image => <ImageCard key={image.image} image={image} isExpanded={expandedImages.includes(image.image)} onToggle={() => toggleImage(image.image)} />)
                : selectedRun ? <p className='rounded-md border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>{selectedRun.error || 'This scan stored no image results.'}</p>
                    : selectedRunId ? null
                        : report?.images.length ? report.images.map(image => <ImageCard key={image.image} image={image} isExpanded={expandedImages.includes(image.image)} onToggle={() => toggleImage(image.image)} />)
                : loading ? <p className='rounded-md border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>Loading image results…</p>
                    : report ? <p className='rounded-md border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>{report.scanStatus.isRunning ? 'The scan is running; image results will appear as it completes.' : report.scanStatus.lastError || report.scanStatus.blocker || 'No image scan results yet.'}</p>
                        : <p className='rounded-md border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>Image results are unavailable while the Scanner API is offline.</p>}
        </section>

        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3'><h3 className='text-base font-semibold'>Recent image scans</h3><span className='text-xs text-ui-muted'>{runs.length} loaded</span></div>
            {historyError && <p role='status' className='mt-2 text-sm text-ui-warning'>Scan history unavailable: {historyError}</p>}
            <div className='mt-2 divide-y divide-ui-border'>
                {runs.map(run => <article key={run.id} className='py-2 text-sm'>
                    <button type='button' aria-pressed={selectedRunId === run.id} onClick={() => void selectRun(run.id)} disabled={loadingRunId !== null} className='flex w-full flex-wrap items-center justify-between gap-2 text-left disabled:opacity-60'>
                        <span>{safeDate(run.startedAt)} · {run.imageCount} images</span>
                        <span className='flex items-center gap-2'><span className={`text-xs font-semibold ${run.status === 'failed' ? 'text-ui-warning' : 'text-ui-muted'}`}>{run.status.replaceAll('_', ' ')}{run.finishedAt ? ` · finished ${safeDate(run.finishedAt)}` : ''}</span><span className='text-xs font-semibold text-ui-primary'>{selectedRunId === run.id && selectedRun ? 'Viewing' : loadingRunId === run.id ? 'Loading…' : 'View findings'}</span></span>
                    </button>
                    {run.error && <p className='mt-1 text-xs text-ui-warning'>{run.error}</p>}
                </article>)}
                {!runs.length && !loadingHistory && <p className='py-3 text-sm text-ui-muted'>{historyError ? 'No scan history available.' : 'No image scans recorded yet.'}</p>}
            </div>
            {nextCursor && <button type='button' onClick={() => void loadHistory(nextCursor, true)} disabled={loadingHistory} className='mt-3 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{loadingHistory ? 'Loading…' : 'Load older scans'}</button>}
        </section>
    </div>
}

function mergeRuns(current: UvmImageScanHistoryEntry[], incoming: UvmImageScanHistoryEntry[]) {
    const byId = new Map(current.map(run => [run.id, run]))
    incoming.forEach(run => byId.set(run.id, run))
    return [...byId.values()]
}

function safeDate(value: string | null | undefined) {
    if (!value || Number.isNaN(new Date(value).getTime())) return '—'
    return formatOsloShortDateTime(value)
}
