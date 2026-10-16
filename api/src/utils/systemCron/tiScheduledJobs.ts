import type { ScheduledJobTelemetry, UnifiedScheduledJob } from '../systemCron.ts'
import { fetchTiJson, tiBase } from './tiScraperClient.ts'
import { numberValue, record } from './tiJobProjection.ts'
import { tiAutomaticReviewJob, tiCollectionJob, tiRestrictedMetadataJob, tiAutomaticEvaluationJob } from './tiCollectionJobProjection.ts'
import { tiExposureQueueJob, tiExposureParserJob } from './tiExposureJobProjection.ts'
import { tiAlertGenerationJob, tiSourcePackWorkerJob, tiFrontierQueueJob } from './tiWorkflowJobProjection.ts'
import { tiUnavailableJobs } from './tiJobProjection.ts'

export async function listTiScheduledJobs(): Promise<UnifiedScheduledJob[]> {
    const base = tiBase()
    if (!base) return tiUnavailableJobs('TI_SCRAPER_API_BASE is not configured.')

    const [scheduler, scraperHealth, exposureQueue, parserHealth, alertReadiness, resources, sourcePacks, frontier] = await Promise.all([
        fetchTiJson('/v1/ops/collection-scheduler'),
        fetchTiJson('/v1/health'),
        fetchTiJson('/v1/dwm/exposure-queue?limit=25'),
        fetchTiJson('/v1/dwm/exposure-parser/health'),
        fetchTiJson('/v1/dwm/alerts/generation-readiness?tenantId=default'),
        fetchTiJson('/v1/ops/resource-snapshot'),
        fetchTiJson('/v1/dwm/source-packs?terms=default'),
        fetchTiJson('/v1/frontier'),
    ])

    const schedulerJson = record(scheduler.json)
    const schedulerState = record(schedulerJson.scheduler)
    const resourceJson = record(resources.json)
    const queueDepth = numberValue(record(resourceJson.queue).queued ?? record(resourceJson.queue).currentItems ?? record(frontier.json).queued)
    const tiTelemetry: ScheduledJobTelemetry = {
        scope: resources.ok ? 'service' : 'unavailable',
        cpuPercent: null,
        memoryRssMb: numberValue(record(resourceJson.memory).rssMb),
        memoryUsedMb: numberValue(record(resourceJson.memory).heapUsedMb),
        queueDepth,
        note: resources.ok
            ? 'TI scraper service-level telemetry; exact per-job CPU/RAM is not exposed.'
            : resources.error || 'TI scraper resource endpoint unavailable.',
    }

    return [
        tiCollectionJob(scheduler, tiTelemetry),
        tiRestrictedMetadataJob(scraperHealth, tiTelemetry),
        tiExposureQueueJob(exposureQueue, schedulerJson, tiTelemetry),
        tiExposureParserJob(parserHealth, schedulerJson, tiTelemetry),
        tiAlertGenerationJob(alertReadiness, tiTelemetry),
        tiSourcePackWorkerJob(sourcePacks, tiTelemetry),
        tiFrontierQueueJob(frontier, schedulerState, tiTelemetry),
        tiAutomaticReviewJob(resources, tiTelemetry),
        tiAutomaticEvaluationJob(resources, tiTelemetry),
    ]
}
