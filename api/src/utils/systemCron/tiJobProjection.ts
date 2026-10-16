import type {
    ScheduledJobCategory,
    ScheduledJobControl,
    ScheduledJobStatus,
    ScheduledJobTelemetry,
    UnifiedScheduledJob,
} from '../systemCron.ts'
import { costEstimate, scheduledJobControlMode, unavailableTelemetry } from './jobMetrics.ts'

export function tiLoopStatus(state: { available: boolean, enabled: boolean, running: boolean, failed?: boolean }): ScheduledJobStatus {
    if (!state.available) return 'blocked'
    if (!state.enabled) return 'paused'
    if (state.running) return 'running'
    return state.failed ? 'failed' : 'enabled'
}

export type TiScheduledJobInput = Omit<UnifiedScheduledJob, 'category' | 'service' | 'costEstimate'> & {
    category?: ScheduledJobCategory
    powerWatts?: number | null
    powerAssumption: string
}

export function tiScheduledJob(input: TiScheduledJobInput): UnifiedScheduledJob {
    const { powerWatts = 75, powerAssumption, category = 'TI / Exposure', resourceUsage, ...job } = input
    return {
        ...job,
        category,
        service: 'ti-scraper',
        resourceUsage,
        costEstimate: costEstimate(powerWatts, powerAssumption),
    }
}
export function tiUnavailableJobs(reason: string): UnifiedScheduledJob[] {
    const unavailable = unavailableTelemetry(reason)
    return [
        blockedTiJob('ti-public-canary-collection', 'Public TI collection loop', 'Scraper-native recurring collection loop for public CTI and exposure sources.', 'scraper/src/ops/canaryCollection.ts', ['pause', 'run_now'], unavailable),
        blockedTiJob('ti-restricted-metadata-collection', 'Restricted metadata collection loop', 'Metadata-only collection from approved restricted sources.', 'scraper/src/ops/restrictedMetadataCollection.ts', [], unavailable),
        blockedTiJob('ti-exposure-queue-collection', 'DWM exposure queue collection', 'Recurring exposure-claim queue populated by TI captures.', 'scraper/src/api/exposureQueueRoutes.ts', [], unavailable),
        blockedTiJob('ti-exposure-parser', 'Exposure parser bridge', 'Exposure claim parser status for Hanasand AI/local fallback parsing.', 'scraper/src/api/exposureQueueRoutes.ts', [], unavailable),
        blockedTiJob('ti-dwm-alert-generation', 'DWM alert generation readiness', 'Alert candidate and case-generation readiness for DWM workflows.', 'scraper/src/api/dwmWorkflowRoutes.ts', ['run_now'], unavailable, 'Alerts'),
        blockedTiJob('ti-source-pack-worker', 'DWM source-pack worker', 'Source-pack and parser-family readiness worker.', 'scraper/src/api/dwmSourceRequestRoute.ts', ['run_now'], unavailable),
        blockedTiJob('ti-frontier-queue', 'TI frontier queue', 'Internal scraper collection task queue.', 'scraper/src/frontier/frontier.ts', [], unavailable),
        blockedTiJob('ti-automatic-review', 'Automatic claim and incident review', 'Startup-owned Hanasand AI review worker for eligible retained claims and incidents.', 'scraper/src/api/automaticReviewRoutes.ts', [], unavailable),
        blockedTiJob('ti-automatic-evaluation', 'Independent automatic accuracy evaluation', 'Startup-owned prediction-hidden evaluation loop over retained evidence and immutable labels.', 'scraper/src/api/evaluationBenchmarkRoutes.ts', [], unavailable),
    ]
}

function blockedTiJob(id: string, name: string, description: string, source: string, controls: ScheduledJobControl[], resourceUsage: ScheduledJobTelemetry, category: ScheduledJobCategory = 'TI / Exposure'): UnifiedScheduledJob {
    return {
        id,
        name,
        description,
        category,
        source,
        service: 'ti-scraper',
        schedule: 'Unavailable',
        cadenceSeconds: null,
        enabled: false,
        running: false,
        status: 'blocked',
        lastRunAt: null,
        lastSuccessAt: null,
        lastFinishedAt: null,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 1,
        lastError: resourceUsage.note,
        logExcerpt: resourceUsage.note,
        controls,
        controlMode: scheduledJobControlMode(controls),
        resourceUsage,
        costEstimate: costEstimate(null, 'TI backend unavailable; cost cannot be estimated from live service state.'),
        assumptions: ['Registry entry is present so this scheduled work remains discoverable even when the scraper API is down.'],
    }
}
export function record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

export function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null
}

export function numberValue(value: unknown): number | null {
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    return Number.isFinite(number) ? number : null
}
