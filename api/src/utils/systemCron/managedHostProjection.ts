import { costEstimate, unavailableTelemetry } from './jobMetrics.ts'
import { cronCadenceSeconds } from './cronCadence.ts'
import type { ManagedCronJob, UnifiedScheduledJob } from './types.ts'

export function managedHostCronJob(job: ManagedCronJob): UnifiedScheduledJob {
    const running = false
    return {
        id: job.id,
        name: job.name,
        description: job.description,
        category: job.category || 'Forgejo',
        source: 'api/src/utils/systemCron.ts',
        service: job.service || 'forgejo',
        schedule: job.schedule,
        cadenceSeconds: cronCadenceSeconds(job.schedule),
        enabled: job.enabled,
        running,
        status: job.enabled ? 'enabled' : 'paused',
        installed: job.installed,
        command: job.command,
        host: job.host,
        logPath: job.logPath,
        lastRunAt: job.lastLogAt,
        lastSuccessAt: job.lastLogAt,
        lastFinishedAt: job.lastLogAt,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 0,
        lastError: null,
        logExcerpt: job.lastLogLine,
        controls: ['edit_schedule', job.enabled ? 'pause' : 'resume'],
        controlMode: 'editable',
        resourceUsage: unavailableTelemetry('Host cron logs are visible, but per-run CPU/RAM is not exposed by crontab.'),
        costEstimate: costEstimate(8, 'Estimated host-script average draw while scheduled; exact Forgejo cron power is not metered per job.'),
        assumptions: ['Host cron has log timestamps only; runtime and resource usage require shell wrapper metrics.'],
    }
}
