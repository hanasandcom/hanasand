import type { ReactNode } from 'react'
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Gauge } from 'lucide-react'

type Props = {
    runningCount: number
    queuedCount: number
    scanCount: number
    failedCount: number
    p95: number | null
    loadedAt: Date | null
}

export function LoadTestOperationsSnapshot({ runningCount, queuedCount, scanCount, failedCount, p95, loadedAt }: Props) {
    return <aside className='grid content-start gap-3 border-t border-ui-border bg-ui-raised p-4 lg:border-l lg:border-t-0'>
        <h3 className='text-sm font-semibold text-ui-text'>Operations snapshot</h3>
        <SnapshotRow icon={<Activity className='h-4 w-4' />} label='Now' value={runningCount ? `${runningCount} running` : 'No active checks'} tone={runningCount ? 'watch' : 'ok'} />
        <SnapshotRow icon={<Gauge className='h-4 w-4' />} label='Queue' value={queuedCount ? `${queuedCount} waiting` : 'Clear'} tone={queuedCount ? 'watch' : 'ok'} />
        <SnapshotRow icon={<CheckCircle2 className='h-4 w-4' />} label='History' value={scanCount ? `${scanCount} recent` : 'No runs yet'} tone='neutral' />
        <SnapshotRow icon={<Gauge className='h-4 w-4' />} label='Latest p95' value={p95 ? `${p95}ms` : 'Waiting for a run'} tone={p95 && p95 > 1000 ? 'watch' : 'ok'} />
        <SnapshotRow icon={<AlertTriangle className='h-4 w-4' />} label='Failures' value={failedCount ? String(failedCount) : 'Clear'} tone={failedCount ? 'bad' : 'ok'} />
        <SnapshotRow icon={<Gauge className='h-4 w-4' />} label='Latency' value='p95/p99 evidence' tone='neutral' />
        <SnapshotRow icon={<ArrowRight className='h-4 w-4' />} label='Artifacts' value='logs + share link' tone='neutral' />
        <details className='rounded-lg border border-ui-border bg-ui-panel' data-load-test-policy-disclosure>
            <summary className='cursor-pointer list-none px-3 py-2 text-sm font-semibold text-ui-text [&::-webkit-details-marker]:hidden'>Policy and evidence</summary>
            <div className='grid gap-2 border-t border-ui-border p-3'>
                <PolicyRow label='Allowed target' value='HTTP/S endpoints you own or are permitted to test' />
                <PolicyRow label='Evidence' value='status, p95 latency, failure rate, logs, errors' />
                <PolicyRow label='Refresh' value={loadedAt ? loadedAt.toLocaleTimeString() : 'loading history'} />
            </div>
        </details>
    </aside>
}

function SnapshotRow({ icon, label, value, tone }: { icon: ReactNode, label: string, value: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const toneClass = tone === 'bad'
        ? 'text-ui-text'
        : tone === 'watch'
            ? 'text-ui-warning'
            : tone === 'ok'
                ? 'text-ui-success'
                : 'text-ui-primary'
    return <div className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
        <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase text-ui-subtle'>{label}</p>
            <p className='truncate text-sm font-semibold text-ui-text'>{value}</p>
        </div>
        <span className={toneClass}>{icon}</span>
    </div>
}

function PolicyRow({ label, value }: { label: string, value: string }) {
    return <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
        <p className='text-xs font-semibold uppercase text-ui-subtle'>{label}</p>
        <p className='mt-1 text-sm leading-5 text-ui-text'>{value}</p>
    </div>
}
