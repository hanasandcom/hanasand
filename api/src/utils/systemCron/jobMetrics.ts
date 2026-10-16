import type {
    ScheduledJobControl,
    ScheduledJobCostEstimate,
    ScheduledJobTelemetry,
    UnifiedScheduledJob,
} from '../systemCron.ts'

const ELECTRICITY_USD_PER_KWH = Number(process.env.BACKGROUND_JOB_ELECTRICITY_USD_PER_KWH || '0.05')

export function scheduledJobControlMode(controls: ScheduledJobControl[]): UnifiedScheduledJob['controlMode'] {
    if (controls.length === 1 && controls[0] === 'run_now') return 'run_only'
    return controls.length ? 'safe_control' : 'observable_only'
}

export function ageMs(iso: string | null) {
    if (!iso) return null
    const time = Date.parse(iso)
    return Number.isFinite(time) ? Math.max(0, Date.now() - time) : null
}

export function secondsSchedule(seconds: number) {
    if (seconds < 60) return `Every ${seconds} seconds`
    const minutes = Math.round(seconds / 60)
    return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`
}

export function unavailableTelemetry(note: string): ScheduledJobTelemetry {
    return {
        scope: 'unavailable',
        cpuPercent: null,
        memoryRssMb: null,
        memoryUsedMb: null,
        queueDepth: null,
        note,
    }
}

export function costEstimate(powerWatts: number | null, assumption: string): ScheduledJobCostEstimate {
    const hourlyUsd = powerWatts === null ? null : (powerWatts / 1000) * ELECTRICITY_USD_PER_KWH
    return {
        scope: powerWatts === null ? 'unavailable' : 'service',
        electricityUsdPerKwh: ELECTRICITY_USD_PER_KWH,
        powerWatts,
        hourlyUsd: hourlyUsd === null ? null : roundMoney(hourlyUsd),
        dailyUsd: hourlyUsd === null ? null : roundMoney(hourlyUsd * 24),
        assumption,
    }
}

function roundMoney(value: number) {
    return Math.round(value * 10000) / 10000
}
