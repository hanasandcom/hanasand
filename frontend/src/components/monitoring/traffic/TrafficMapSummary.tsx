import formatRequestTime from '@/utils/monitoring/formatRequestTime'
import type { TrafficMetrics } from '@/utils/monitoring/types'
import { Activity, Clock3, Globe2, Zap } from 'lucide-react'
import { StatCard } from './liveMapPrimitives'
import type { TrafficCountryPoint } from '@/utils/monitoring/liveTrafficMap'

type Props = {
    status: string
    isConnecting: boolean
    isOperational: boolean
    countryEntries: TrafficCountryPoint[]
    trackedRequestsValue: number
    metrics: TrafficMetrics | null
}

export default function TrafficMapSummary({ status, isConnecting, isOperational, countryEntries, trackedRequestsValue, metrics }: Props) {
    return (
        <>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-5 py-4'>
                <div>
                    <h1 className='text-xl font-semibold text-ui-text'>Live traffic map</h1>
                    <p className='mt-1 text-sm text-ui-muted'>
                        Zoomable global view of recent request hotspots, live ingress pulses, and top traffic patterns.
                    </p>
                </div>
                <div
                    role='status'
                    aria-live='polite'
                    data-traffic-stream-status
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                        isConnecting
                            ? 'border-ui-border bg-ui-raised text-ui-muted'
                            : isOperational
                                ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
                                : 'border-ui-danger/30 bg-ui-raised/10 text-ui-text'
                    }`}
                >
                    <span className={`h-2 w-2 rounded-full ${isConnecting ? 'animate-pulse bg-ui-muted' : isOperational ? 'bg-ui-success' : 'bg-ui-raised'}`} />
                    {status}
                </div>
            </div>


            <div className='grid gap-3 border-b border-ui-border px-5 py-4 sm:grid-cols-2 xl:grid-cols-4'>
                <StatCard icon={<Globe2 className='h-4 w-4' />} label='Active Countries' value={String(countryEntries.length)} />
                <StatCard icon={<Activity className='h-4 w-4' />} label='Tracked Requests' value={String(trackedRequestsValue)} />
                <StatCard icon={<Zap className='h-4 w-4' />} label='Top Country' value={countryEntries[0]?.iso || 'Unknown'} />
                <StatCard icon={<Clock3 className='h-4 w-4' />} label='Avg Request Time' value={formatRequestTime(metrics)} />
            </div>
        </>
    )
}
