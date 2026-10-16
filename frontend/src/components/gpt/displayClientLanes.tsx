function Lane({ lane }: { lane: GPT_ModelLaneMetrics }) {
    const memoryPercent = lane.memoryTotalMb > 0 ? Math.round(lane.memoryUsedMb / lane.memoryTotalMb * 100) : 0
    const capacityPercent = lane.maxRequests > 0 ? Math.round(lane.activeRequests / lane.maxRequests * 100) : 0
    const gpuLabel = lane.gpuIndices?.length ? `GPUs ${lane.gpuIndices.join(', ')}` : `GPU ${lane.gpuIndex}`
    const tierLabel = lane.tier === 'strong' ? 'Strong' : 'Fast'

    return (
        <div className='rounded-xl bg-ui-canvas/20 p-3 outline outline-ui-border'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                <div>
                    <div className='text-sm font-semibold text-ui-text/90'>
                        {lane.label || `Lane ${lane.index + 1}`} · {tierLabel}
                    </div>
                    <div className='mt-1 text-xs text-ui-text/45'>
                        {lane.model || lane.gpuName} • {gpuLabel}
                    </div>
                </div>
                <div className='grid gap-2 sm:grid-cols-4 lg:min-w-[34rem]'>
                    <LaneMetric
                        label='capacity'
                        value={`${lane.availableRequests}/${lane.maxRequests}`}
                        tone={capacityPercent < 75 ? 'ok' : 'warn'}
                    />
                    <LaneMetric
                        label='memory'
                        value={`${memoryPercent}%`}
                        tone={memoryPercent < 86 ? 'ok' : 'warn'}
                    />
                    <LaneMetric
                        label='power'
                        value={`${lane.powerDrawWatts.toFixed(0)} W`}
                        tone={lane.powerLimitWatts && lane.powerDrawWatts / lane.powerLimitWatts > 0.85 ? 'warn' : 'ok'}
                    />
                    <LaneMetric
                        label='temp'
                        value={`${lane.temperatureC.toFixed(0)}°C`}
                        tone={lane.temperatureC < 78 ? 'ok' : 'warn'}
                    />
                </div>
            </div>
        </div>
    )
}

function LaneMetric({ label, value, tone }: { label: string, value: string, tone: 'ok' | 'warn' }) {
    return (
        <div className={`rounded-lg px-3 py-2 ${tone === 'ok' ? 'bg-ui-success/10 text-ui-success' : 'bg-ui-warning/10 text-ui-warning'}`}>
            <div className='text-[10px] uppercase tracking-[0.18em] text-current/70'>{label}</div>
            <div className='mt-1 text-sm font-semibold'>{value}</div>
        </div>
    )
}

export default Lane
