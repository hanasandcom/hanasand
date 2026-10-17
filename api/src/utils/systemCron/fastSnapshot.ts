import { managedCronDefinitions } from './managedDefinitions.ts'
import { apiBackgroundJobDefinitions } from './apiJobDefinitions/index.ts'
import { canRunApiCronJobNow } from '../cron.ts'
import { costEstimate, scheduledJobControlMode, unavailableTelemetry } from './jobMetrics.ts'
import { apiBackgroundJobControls, apiBackgroundJobDefinitionFields } from './jobProjections.ts'
import { tiUnavailableJobs } from './tiJobProjection.ts'
import { cronCadenceSeconds } from './cronCadence.ts'
import type { ScheduledJobControl, UnifiedScheduledJob } from './types.ts'

export function fastUnifiedScheduledJobs(): UnifiedScheduledJob[] {
    const telemetry = unavailableTelemetry('Live job state is refreshing.')
    const apiJobs = visibleApiBackgroundJobDefinitions().map(job => {
        const controls = apiBackgroundJobControls(job, true, false)
        return {
            ...apiBackgroundJobDefinitionFields(job),
            enabled: job.isEnabled?.() ?? true, running: false, status: 'unknown' as const,
            lastRunAt: null, lastSuccessAt: null, lastFinishedAt: null, nextRunAt: null,
            currentRunDurationMs: null, averageRuntimeMs: null, failureCount: 0, lastError: null,
            logExcerpt: 'Live state is refreshing.', controls,
            controlMode: scheduledJobControlMode(controls),
            resourceUsage: telemetry, costEstimate: costEstimate(18, 'Live cost estimate is refreshing.'),
            assumptions: ['This immediate registry snapshot will be replaced by live runtime state.'],
        }
    })
    const managedJobs = managedCronDefinitions.map(job => ({
        id: job.id, name: job.name, description: job.description, category: job.category || 'Forgejo' as const,
        source: 'api/src/utils/systemCron.ts', service: job.service || 'forgejo', schedule: job.defaultSchedule,
        cadenceSeconds: cronCadenceSeconds(job.defaultSchedule), enabled: false, running: false, status: 'unknown' as const,
        installed: false, command: job.command, host: job.host, logPath: job.logPath,
        lastRunAt: null, lastSuccessAt: null, lastFinishedAt: null, nextRunAt: null,
        currentRunDurationMs: null, averageRuntimeMs: null, failureCount: 0, lastError: null,
        logExcerpt: 'Live state is refreshing.', controls: ['edit_schedule', 'resume'] as ScheduledJobControl[],
        controlMode: 'editable' as const, resourceUsage: telemetry,
        costEstimate: costEstimate(8, 'Live cost estimate is refreshing.'),
        assumptions: ['This immediate registry snapshot will be replaced by live crontab state.'],
    }))
    return [...tiUnavailableJobs('Live TI state is refreshing.'), ...apiJobs, ...managedJobs]
}

function visibleApiBackgroundJobDefinitions() {
    return apiBackgroundJobDefinitions.filter(job => job.id !== 'api-mail-account-provisioning' || canRunApiCronJobNow(job.id))
}
