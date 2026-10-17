'use client'

import { useEffect, useMemo, useState } from 'react'
import ThroughputChart from './ThroughputChart'
import { age, format } from './throughputFormatting'
import { formatLogCount } from './logPresentation'

export type Point = { sampled_at: string, pps: number, eps: number, historical_eps: number, npps: number, remaining: number }
export type Metrics = { generated_at: string, current: { pps: number, eps: number, historical_eps: number, npps: number, remaining: number, thresholds: { npps_below: boolean, eps_above: boolean, pps_below: boolean } }, history: Point[] }

const cards = [
    ['PPS', 'pps', 'Events checked per second'],
    ['EPS', 'eps', 'New service logs per second'],
    ['Historical EPS', 'historical_eps', 'Backlog processed per second'],
    ['NPPS', 'npps', 'Incoming load ÷ checked throughput'],
] as const
export default function ThroughputMetrics({ initialMetrics }: { initialMetrics: Metrics | null }) {
    const [metrics, setMetrics] = useState<Metrics | null>(initialMetrics)
    const [now, setNow] = useState(0)
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try { const response = await fetch('/api/backend/logs/metrics', { cache: 'no-store' }); const body = await response.json(); if (response.ok && !cancelled) setMetrics(body) } catch { /* Keep the last successful sample visible. */ }
        }
        setNow(Date.now())
        if (!initialMetrics) void load()
        const interval = setInterval(() => { void load(); setNow(Date.now()) }, 5000)
        return () => { cancelled = true; clearInterval(interval) }
    }, [initialMetrics])
    const points = useMemo(() => metrics?.history || [], [metrics])
    if (!metrics) return null
    return <section id='log-analytics' aria-label='Log throughput metrics' className='grid gap-3' data-log-throughput>
        <div className='grid grid-cols-2 gap-2.5 min-[380px]:gap-3 md:grid-cols-3 xl:grid-cols-5'>{cards.map(([label, key, description]) => <div key={key} className='min-w-0 rounded-xl border border-ui-border bg-ui-panel p-3 sm:p-4'><p className='text-xs text-ui-muted sm:text-sm'>{label}</p><p className='mt-1.5 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl'>{format(metrics.current[key])}</p><p className='mt-1 text-[11px] leading-4 text-ui-muted sm:text-xs'>{description}</p></div>)}<div className='min-w-0 rounded-xl border border-ui-border bg-ui-panel p-3 sm:p-4'><p className='text-xs text-ui-muted sm:text-sm'>Logs remaining</p><p className='mt-1.5 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl'>{formatLogCount(metrics.current.remaining)}</p><p className='mt-1 text-[11px] leading-4 text-ui-muted sm:text-xs'>{age(metrics.generated_at, now)}</p></div></div>
        <div className='grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3'>{(['eps', 'pps', 'npps'] as const).map(field => <ThroughputChart key={field} title={field.toUpperCase()} points={points} field={field} />)}</div>
    </section>
}
