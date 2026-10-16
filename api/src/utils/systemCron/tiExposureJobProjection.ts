import type { ScheduledJobTelemetry, UnifiedScheduledJob } from '../systemCron.ts'
import type { TiFetchResult } from './tiScraperClient.ts'
import { secondsSchedule } from './jobMetrics.ts'
import { numberValue, record, stringValue, tiScheduledJob } from './tiJobProjection.ts'

export function tiExposureQueueJob(result: TiFetchResult, schedulerPayload: Record<string, unknown>, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const scheduler = record(payload.scheduler)
    const freshness = record(payload.freshness)
    const counts = record(payload.counts)
    const cadenceSeconds = numberValue(scheduler.cadenceSeconds) ?? numberValue(record(schedulerPayload.scheduler).intervalSeconds) ?? 300
    return tiScheduledJob({
        id: 'ti-exposure-queue-collection',
        name: 'DWM exposure queue collection',
        description: 'Recurring exposure-claim queue populated by metadata-only dark web, public-channel, and advisory captures.',
        source: 'scraper/src/api/exposureQueueRoutes.ts',
        schedule: secondsSchedule(cadenceSeconds),
        cadenceSeconds,
        enabled: result.ok,
        running: false,
        status: result.ok ? payload.status === 'live' ? 'enabled' : 'observable' : 'blocked',
        lastRunAt: stringValue(freshness.latestCollectedAt ?? freshness.latestClaimAt),
        lastSuccessAt: stringValue(freshness.latestCollectedAt ?? freshness.latestClaimAt),
        lastFinishedAt: stringValue(freshness.latestCollectedAt ?? freshness.latestClaimAt),
        nextRunAt: stringValue(freshness.nextExpectedCollection ?? record(schedulerPayload.scheduler).nextRunAt),
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 0,
        lastError: result.error,
        logExcerpt: result.ok ? `${counts.visible ?? 0} visible claims, ${counts.needsReview ?? 0} need review.` : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage,
        powerAssumption: 'Shares the ti-scraper collection service power estimate.',
        assumptions: ['Exposure queue is populated by the Public TI collection loop. Use that job to pause/resume or run collection; this card audits the derived queue only.'],
    })
}

export function tiExposureParserJob(result: TiFetchResult, schedulerPayload: Record<string, unknown>, resourceUsage: ScheduledJobTelemetry): UnifiedScheduledJob {
    const payload = record(result.json)
    const parser = record(schedulerPayload.parser)
    return tiScheduledJob({
        id: 'ti-exposure-parser',
        name: 'Exposure parser bridge',
        description: 'Parses exposure claims via Hanasand AI when configured, with a local metadata-safe fallback parser.',
        source: 'scraper/src/api/exposureQueueRoutes.ts',
        schedule: 'On exposure ingest',
        cadenceSeconds: null,
        enabled: result.ok || Boolean(parser.aiEndpointConfigured),
        running: false,
        status: result.ok ? payload.status === 'ready' ? 'enabled' : 'observable' : 'blocked',
        lastRunAt: null,
        lastSuccessAt: result.ok ? stringValue(payload.generatedAt) : null,
        lastFinishedAt: result.ok ? stringValue(payload.generatedAt) : null,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: numberValue(payload.latencyMs),
        failureCount: result.ok ? 0 : 1,
        lastError: stringValue(payload.blocker) ?? result.error,
        logExcerpt: result.ok ? `Parser status ${payload.status}; latency ${payload.latencyMs ?? 'unknown'}ms.` : result.error,
        controls: [],
        controlMode: 'observable_only',
        resourceUsage,
        powerWatts: null,
        powerAssumption: 'Parser power is included in ti-scraper and optional Hanasand AI services; no separate meter is available.',
        assumptions: ['Parser execution is request-driven by exposure ingest and source-pack worker validation. Run the upstream collection/source-pack jobs to create parser work.'],
    })
}
