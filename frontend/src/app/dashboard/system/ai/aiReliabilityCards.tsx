import { type ReactNode } from 'react'
import { Activity, Timer } from 'lucide-react'
import type { AIEconomics } from './aiEconomicsTypes'

export function ReliabilityCards({ economics, error }: {
    economics: AIEconomics | null
    error: string | null
}) {
    if (error || !economics) {
        return (
            <div
                className='rounded-lg border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'
                role={error ? 'alert' : 'status'}
            >
                {error || 'Loading activity…'}
            </div>
        )
    }

    const { reliability } = economics
    const queuedRows = reliability.queueDepth.filter(row => row.status === 'queued' || row.status === 'running')
    const responseTime = reliability.promptTiming.sampleCount
        ? formatDuration(reliability.promptTiming.p50FirstUsefulOutputMs)
        : 'No runs yet'
    const responseDetail = reliability.promptTiming.sampleCount
        ? `Typical response time · ${reliability.promptTiming.sampleCount} runs`
        : 'Shown after the first completed run'
    const queueTotal = queuedRows.reduce((total, row) => total + row.count, 0)

    return (
        <>
            <EconomicsStat
                icon={<Timer className='h-4 w-4' />}
                label='Time to first response'
                value={responseTime}
                detail={responseDetail}
            />
            <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex items-center justify-between gap-2 text-ui-muted'>
                    <span className='text-xs font-medium uppercase tracking-[0.18em]'>Active and queued work</span>
                    <Activity className='h-4 w-4 shrink-0' />
                </div>
                <div className='mt-3 text-2xl font-semibold text-ui-text'>{queueTotal} runs</div>
                {queuedRows.length ? (
                    <details className='mt-1 text-xs text-ui-muted'>
                        <summary className='cursor-pointer'>View work</summary>
                        <div className='mt-2 max-h-40 space-y-2 overflow-auto'>
                            {queuedRows.map(row => (
                                <div
                                    key={`${row.lane}-${row.model}-${row.kind}-${row.status}`}
                                    className='grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-ui-border bg-ui-raised px-2 py-1'
                                >
                                    <div className='min-w-0 wrap-break-word'>
                                        <p className='font-medium text-ui-text'>{row.lane} · {row.model}</p>
                                        <p>{row.kind} · {row.status}</p>
                                    </div>
                                    <span className='self-center font-semibold text-ui-text'>{row.count}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                ) : <p className='mt-1 text-xs leading-5 text-ui-muted'>No work is running or waiting.</p>}
            </div>
        </>
    )
}

function EconomicsStat({ icon, label, value, detail }: {
    icon: ReactNode
    label: string
    value: string
    detail: string
}) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-2 text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>{label}</span>
                <span className='text-ui-primary'>{icon}</span>
            </div>
            <div className='mt-3 text-2xl font-semibold text-ui-text'>{value}</div>
            <p className='mt-1 text-xs leading-5 text-ui-muted'>{detail}</p>
        </div>
    )
}

export function formatDuration(value: number) {
    if (!value) return '—'
    if (value < 1000) return `${Math.round(value)} ms`
    const seconds = value / 1000
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
    const minutes = seconds / 60
    if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`
    return `${(minutes / 60).toFixed(1)} h`
}
