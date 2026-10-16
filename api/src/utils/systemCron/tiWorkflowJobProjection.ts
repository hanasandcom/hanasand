import type { ScheduledJobTelemetry, UnifiedScheduledJob } from '../systemCron.ts'
import type { TiFetchResult } from './tiScraperClient.ts'
import { record, arrayValue, numberValue, stringValue, tiScheduledJob } from './tiJobProjection.ts'

export function tiAlertGenerationJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const blockers = arrayValue(payload.blockers ?? payload.blockerCodes)
    const generatedAt = stringValue(payload.generatedAt)
    return tiScheduledJob({
        id: 'ti-dwm-alert-generation',
        name: 'DWM alert generation readiness',
        description: 'Alert candidate and case-generation readiness for DWM/customer exposure workflows.',
        category: 'Alerts',
        source: 'scraper/src/api/dwmWorkflowRoutes.ts',
        schedule: 'On watchlist/source changes; manually runnable',
        cadenceSeconds: null,
        enabled: result.ok,
        running: false,
        status: result.ok ? blockers.length ? 'failed' : 'enabled' : 'blocked',
        lastRunAt: generatedAt,
        lastSuccessAt: result.ok && !blockers.length ? generatedAt : null,
        lastFinishedAt: generatedAt,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: blockers.length,
        lastError: blockers.length ? blockers.join('; ') : result.error,
        logExcerpt: result.ok ? `Candidates ${payload.candidateCount ?? 'unknown'}; latest evidence ${payload.latestEvidenceAt ?? 'unknown'}.` : result.error,
        controls: ['run_now'],
        controlMode: 'run_only',
        resourceUsage,
        powerAssumption: 'Shares the ti-scraper service power estimate.',
        assumptions: ['Run now calls the existing alert rebuild endpoint; pause is not exposed because alert generation is request-driven.'],
    })
}

export function tiSourcePackWorkerJob(result: TiFetchResult, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const readiness = record(payload.readiness)
    const lastRun = record(payload.lastRun)
    return tiScheduledJob({
        id: 'ti-source-pack-worker',
        name: 'DWM source-pack worker',
        description: 'Builds and verifies DWM source packs and parser family readiness for customer exposure coverage.',
        source: 'scraper/src/api/dwmSourceRequestRoute.ts',
        schedule: 'On source-pack/status requests',
        cadenceSeconds: null,
        enabled: result.ok,
        running: false,
        status: result.ok ? readiness.ready === false ? 'failed' : 'observable' : 'blocked',
        lastRunAt: stringValue(lastRun.updatedAt ?? payload.generatedAt),
        lastSuccessAt: result.ok ? stringValue(lastRun.updatedAt ?? payload.generatedAt) : null,
        lastFinishedAt: stringValue(lastRun.updatedAt ?? payload.generatedAt),
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: arrayValue(readiness.blockers).length,
        lastError: arrayValue(readiness.blockers).join('; ') || result.error,
        logExcerpt: result.ok ? `${record(payload.counts).candidateCount ?? 0} candidates; ${record(payload.counts).packCount ?? 0} packs.` : result.error,
        controls: ['run_now'],
        controlMode: 'run_only',
        resourceUsage,
        powerAssumption: 'Shares the ti-scraper service power estimate.',
        assumptions: ['Run now calls the existing default source-pack worker contract. Pause is not exposed because source-pack processing is request-driven, not a scheduler loop.'],
    })
}

export function tiFrontierQueueJob(result: TiFetchResult, scheduler: Record<string, unknown>, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const queued = numberValue(payload.queued) ?? resourceUsage.queueDepth
    return tiScheduledJob({
        id: 'ti-frontier-queue',
        name: 'TI frontier queue',
        description: 'Internal queued collection tasks, leases, retries, and dead letters used by scraper collection.',
        source: 'scraper/src/frontier/frontier.ts',
        schedule: 'Driven by collection loop and ad hoc TI runs',
        cadenceSeconds: null,
        enabled: true,
        running: Boolean(record(scheduler).running),
        status: result.ok ? queued ? 'running' : 'observable' : 'blocked',
        lastRunAt: null,
        lastSuccessAt: result.ok ? new Date().toISOString() : null,
        lastFinishedAt: result.ok ? new Date().toISOString() : null,
        nextRunAt: stringValue(scheduler.nextRunAt),
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 0,
        lastError: result.error,
        logExcerpt: result.ok ? `${queued ?? 0} queued task${queued === 1 ? '' : 's'}.` : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage,
        powerAssumption: 'Shares the ti-scraper service power estimate.',
        assumptions: ['Frontier contains queued and leased collection tasks. Pause/resume belongs on the collection loop; direct queue mutation would risk interrupting leased work.'],
    })
}
