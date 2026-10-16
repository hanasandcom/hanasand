'use client'

import { countryCentroids } from '@/utils/monitoring/geo'
import {
    CAPITAL_MARKERS,
    countryIsoForTrafficRecord,
    getCountryFocusView,
} from '@/utils/monitoring/liveTrafficMap'
import { useMemo } from 'react'
import { useTrafficMapStream } from './useTrafficMapStream'
import TrafficMapCanvas from './TrafficMapCanvas'
import TrafficMapSummary from './TrafficMapSummary'
import TrafficMapInsights from './TrafficMapInsights'

import type { TrafficMetrics, TrafficRecord } from '@/utils/monitoring/types'
import type { TrafficSnapshotPayload } from './useTrafficMapStream'

export default function TrafficMap({
    initialMetrics,
    initialRecords,
    selectedDomain,
    onSnapshot,
}: {
    initialMetrics: TrafficMetrics | null
    initialRecords: TrafficRecord[]
    selectedDomain?: string
    onSnapshot?: (snapshot: TrafficSnapshotPayload) => void
}) {
    const {
        status, isConnected, isPolling, viewBox, setViewBox, pings, countries,
        liveRecords, selectedCountry, setSelectedCountry, now, dragRef,
    } = useTrafficMapStream({ initialMetrics, initialRecords, selectedDomain, onSnapshot })

    const countryEntries = useMemo(
        () => Object.values(countries).sort((a, b) => b.count - a.count),
        [countries]
    )
    const selectedPoint = selectedCountry ? countries[selectedCountry] : null
    const selectedCapital = CAPITAL_MARKERS.find((marker) => marker.iso === selectedCountry)
    const totalTrackedRequests = countryEntries.reduce((sum, item) => sum + item.count, 0)
    const trackedRequestsValue = Number(initialMetrics?.total_requests || 0)
    const selectedRank = countryEntries.findIndex((entry) => entry.iso === selectedCountry) + 1
    const selectedShare = selectedPoint && totalTrackedRequests
        ? Math.round((selectedPoint.count / totalTrackedRequests) * 100)
        : 0
    const selectedRecords = useMemo(
        () => liveRecords
            .filter((record) => (
                !selectedCountry
                || countryIsoForTrafficRecord(record) === selectedCountry
            ))
            .slice(0, 6),
        [liveRecords, selectedCountry]
    )
    const isConnecting = status === 'Connecting traffic stream'
    const isOperational = isConnected || isPolling || liveRecords.length > 0 || Number(initialMetrics?.total_requests || 0) > 0

    const strongestCountryCount = countryEntries[0]?.count || 1

    function selectCountry(iso: string) {
        setSelectedCountry(iso)
        const coords = countryCentroids[iso]
        if (coords) setViewBox(getCountryFocusView(coords))
    }

    return (
        <div className='grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_22rem]'>
            <section className='flex min-w-0 flex-col rounded-lg border border-ui-border bg-ui-panel shadow-lg'>
                <TrafficMapSummary
                    status={status}
                    isConnecting={isConnecting}
                    isOperational={isOperational}
                    countryEntries={countryEntries}
                    trackedRequestsValue={trackedRequestsValue}
                    metrics={initialMetrics}
                />
                <TrafficMapCanvas
                    viewBox={viewBox}
                    setViewBox={setViewBox}
                    dragRef={dragRef}
                    selectedCountry={selectedCountry}
                    onSelectCountry={selectCountry}
                    countryEntries={countryEntries}
                    strongestCountryCount={strongestCountryCount}
                    pings={pings}
                    now={now}
                />
            </section>

            <TrafficMapInsights
                selectedCountry={selectedCountry}
                selectedPoint={selectedPoint}
                selectedShare={selectedShare}
                selectedRank={selectedRank}
                selectedCapital={selectedCapital}
                now={now}
                countryEntries={countryEntries}
                selectedRecords={selectedRecords}
                metrics={initialMetrics}
                onSelectCountry={selectCountry}
            />
        </div>
    )
}
