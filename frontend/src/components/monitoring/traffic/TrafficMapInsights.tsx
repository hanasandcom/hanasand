import { countryCentroids } from '@/utils/monitoring/geo'
import {
    formatRelative,
    haversineKilometers,
    NORWAY,
    type TrafficCountryPoint,
} from '@/utils/monitoring/liveTrafficMap'
import { Activity, Globe2, MapPinned, Route, Search } from 'lucide-react'
import { EmptyCopy, InsightCard, SignalGroup } from './liveMapPrimitives'
import type { TrafficMetrics, TrafficRecord } from '@/utils/monitoring/types'

type Props = {
    selectedCountry: string
    selectedPoint: TrafficCountryPoint | null
    selectedShare: number
    selectedRank: number
    selectedCapital?: { label: string }
    now: number
    countryEntries: TrafficCountryPoint[]
    selectedRecords: TrafficRecord[]
    metrics: TrafficMetrics | null
    onSelectCountry: (iso: string) => void
}

export default function TrafficMapInsights({
    selectedCountry,
    selectedPoint,
    selectedShare,
    selectedRank,
    selectedCapital,
    now,
    countryEntries,
    selectedRecords,
    metrics,
    onSelectCountry,
}: Props) {
    const selectedCoords = countryCentroids[selectedCountry]

    return (
        <aside className='flex min-w-0 flex-col gap-4'>
            <InsightCard
                title={selectedCountry === 'NO' ? 'Local Focus' : `Country Focus · ${selectedCountry}`}
                icon={<Search className='h-4 w-4 stroke-ui-primary' />}
            >
                <div className='space-y-2 text-sm text-ui-muted'>
                    <InsightValue label='Requests observed' value={selectedPoint?.count || 0} />
                    <InsightValue label='Last seen' value={selectedPoint ? formatRelative(selectedPoint.lastSeen, now) : 'Listening'} />
                    <InsightValue label='Live share' value={`${selectedShare}%`} />
                    <InsightValue label='Hotspot rank' value={selectedRank || 'checking'} />
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <div className='rounded-lg border border-ui-primary/25 bg-ui-primary/10 px-3 py-3'>
                            <div className='mb-1 flex items-center gap-2 text-ui-primary'>
                                <MapPinned className='h-4 w-4' />
                                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Capital</span>
                            </div>
                            <div className='text-sm font-semibold text-ui-text'>{selectedCapital?.label || 'Resolving'}</div>
                        </div>
                        <div className='rounded-lg border border-ui-warning/25 bg-ui-warning/10 px-3 py-3'>
                            <div className='mb-1 flex items-center gap-2 text-ui-warning'>
                                <Route className='h-4 w-4' />
                                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Oslo Distance</span>
                            </div>
                            <div className='text-sm font-semibold text-ui-text'>
                                {selectedCoords ? `${haversineKilometers(selectedCoords, NORWAY)} km` : 'resolving'}
                            </div>
                        </div>
                    </div>
                    <InsightValue label='Recent requests listed' value={selectedRecords.length} />
                </div>
            </InsightCard>

            <InsightCard title='Live Hotspots' icon={<Globe2 className='h-4 w-4 stroke-ui-success' />}>
                <div className='space-y-2'>
                    {countryEntries.length ? countryEntries.slice(0, 8).map((entry) => (
                        <button
                            key={entry.iso}
                            type='button'
                            onClick={() => onSelectCountry(entry.iso)}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${selectedCountry === entry.iso ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-text' : 'border-ui-border bg-ui-panel text-ui-muted hover:border-ui-primary hover:bg-ui-raised'}`}
                        >
                            <div>
                                <div className='font-medium'>{entry.iso}</div>
                                <div className='text-xs text-ui-muted'>Updated {formatRelative(entry.lastSeen, now)}</div>
                            </div>
                            <div className='rounded-full bg-ui-raised px-2.5 py-1 text-xs font-semibold'>{entry.count}</div>
                        </button>
                    )) : <EmptyCopy text='Traffic hotspots appear as edge records and metrics stream in.' />}
                </div>
            </InsightCard>

            <InsightCard title='Traffic Activity' icon={<Activity className='h-4 w-4 stroke-ui-warning' />}>
                <SignalGroup title='Top Paths' entries={metrics?.top_paths || []} valueLabel='requests' />
                <SignalGroup title='Methods' entries={metrics?.top_methods || []} valueLabel='requests' />
                <SignalGroup title='Statuses' entries={metrics?.top_status_codes || []} valueLabel='hits' />
            </InsightCard>
        </aside>
    )
}

function InsightValue({ label, value }: { label: string, value: string | number }) {
    return (
        <div className='flex items-center justify-between rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
            <span>{label}</span>
            <span className='font-semibold text-ui-text'>{value}</span>
        </div>
    )
}
