import { getBackgroundJobRuntime, type BackgroundJobRuntime } from '../backgroundJobRuntime.ts'
import { canRunApiCronJobNow, isApiCronJobPaused } from '../cron.ts'
import { collectDatabaseBackupServices, DATABASE_BACKUP_JOB_ID } from '../db/backups.ts'
import { PROTECTED_LOG_PROCESSOR_JOB_IDS } from '../events/processor.ts'
import { ageMs, costEstimate, scheduledJobControlMode } from './jobMetrics.ts'
import type { ApiBackgroundJobDefinition } from './apiJobDefinitions/types.ts'
import type { ScheduledJobControl, UnifiedScheduledJob } from './types.ts'

export function apiBackgroundJobControls(
    definition: ApiBackgroundJobDefinition,
    enabled: boolean,
    allowPauseResume = true,
): ScheduledJobControl[] {
    if (PROTECTED_LOG_PROCESSOR_JOB_IDS.has(definition.id)) return []
    const hasRunner = canRunApiCronJobNow(definition.id)
    if (!allowPauseResume) {
        return hasRunner || definition.controls.includes('run_now') ? ['run_now'] : []
    }
    if (!hasRunner) return definition.controls
    return [enabled ? 'pause' : 'resume', 'run_now']
}

export function apiBackgroundJobDefinitionFields(
    definition: ApiBackgroundJobDefinition,
    service = 'hanasand-api',
) {
    return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        source: definition.source,
        service,
        schedule: definition.schedule,
        cadenceSeconds: definition.cadenceSeconds,
    }
}

function mb(bytes: number) {
    return Math.round(bytes / 1024 / 1024)
}

function currentDurationMs(telemetry: BackgroundJobRuntime) {
    return telemetry.running && telemetry.currentRunStartedAt ? ageMs(telemetry.currentRunStartedAt) : null
}

export async function apiBackgroundJob(definition: ApiBackgroundJobDefinition): Promise<UnifiedScheduledJob> {
    if (definition.id === DATABASE_BACKUP_JOB_ID) return databaseBackupScheduledJob(definition)
    const telemetry = getBackgroundJobRuntime(definition.id)
    const hasRunner = canRunApiCronJobNow(definition.id)
    const enabled = hasRunner ? !await isApiCronJobPaused(definition.id) : definition.isEnabled?.() ?? true
    const controls = apiBackgroundJobControls(definition, enabled)
    return {
        ...apiBackgroundJobDefinitionFields(definition),
        enabled,
        running: telemetry.running,
        status: telemetry.running ? 'running' : !enabled ? 'paused' : telemetry.lastError ? 'failed' : 'enabled',
        lastRunAt: telemetry.lastRunAt,
        lastSuccessAt: telemetry.lastSuccessAt,
        lastFinishedAt: telemetry.lastFinishedAt,
        nextRunAt: enabled && definition.cadenceSeconds ? new Date(Date.now() + definition.cadenceSeconds * 1000).toISOString() : null,
        currentRunDurationMs: currentDurationMs(telemetry),
        averageRuntimeMs: telemetry.averageRuntimeMs,
        failureCount: telemetry.failureCount,
        lastError: telemetry.lastError,
        logExcerpt: telemetry.logExcerpt,
        controls,
        controlMode: scheduledJobControlMode(controls),
        resourceUsage: {
            scope: 'service',
            cpuPercent: null,
            memoryRssMb: mb(process.memoryUsage().rss),
            memoryUsedMb: mb(process.memoryUsage().heapUsed),
            queueDepth: null,
            note: 'API process-level memory; per-cron task CPU/RAM is not available without a worker wrapper.',
        },
        costEstimate: costEstimate(18, 'Estimated shared API process draw; cost is service-level, not per cron task.'),
        assumptions: [
            'The API minute cron runs subjobs in one process, so CPU/RAM and power are service-level estimates.',
            hasRunner ? 'Pause/resume is persisted in scheduled_job_controls; run now uses the same tracked job function as the minute cron.' : 'No standalone safe runner is exposed for this API job.',
        ],
    }
}


async function databaseBackupScheduledJob(definition: ApiBackgroundJobDefinition): Promise<UnifiedScheduledJob> {
    const service = (await collectDatabaseBackupServices())[0]
    const enabled = Boolean(service.scheduleEnabled)
    const operations = service.operations || []
    const durations = operations.map(operation => operation.durationMs).filter((value): value is number => value !== null)
    const last = operations[0] || null
    const lastSuccess = operations.find(operation => operation.kind === 'backup' && operation.status === 'succeeded') || null
    const failures = operations.filter(operation => operation.status === 'failed' || operation.status === 'interrupted')
    return {
        ...apiBackgroundJobDefinitionFields(definition),
        schedule: `${service.schedule || 'Unavailable'} UTC`,
        cadenceSeconds: null,
        enabled,
        running: Boolean(service.currentOperation),
        status: service.currentOperation ? 'running' : !enabled ? 'paused' : last?.status === 'failed' || last?.status === 'interrupted' ? 'failed' : 'enabled',
        lastRunAt: last?.startedAt || null,
        lastSuccessAt: lastSuccess?.finishedAt || null,
        lastFinishedAt: last?.finishedAt || null,
        nextRunAt: enabled ? service.nextBackup || null : null,
        currentRunDurationMs: service.currentOperation ? Math.max(0, Date.now() - Date.parse(service.currentOperation.startedAt)) : null,
        averageRuntimeMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        failureCount: failures.length,
        lastError: service.lastError || service.error || null,
        logExcerpt: last ? `${last.kind} ${last.status}: ${last.stage}` : 'No backup attempt has been recorded yet.',
        controls: [enabled ? 'pause' : 'resume', 'run_now'],
        controlMode: 'safe_control',
        resourceUsage: {
            scope: 'service',
            cpuPercent: null,
            memoryRssMb: mb(process.memoryUsage().rss),
            memoryUsedMb: mb(process.memoryUsage().heapUsed),
            queueDepth: service.currentOperation ? 1 : 0,
            note: 'API process memory and durable backup-operation lock state.',
        },
        costEstimate: costEstimate(18, 'Uses the shared API process and PostgreSQL client during an active operation.'),
        assumptions: ['Schedule, next run, attempt, success, failure, and retention evidence come from the persisted backup ledger.'],
    }
}
