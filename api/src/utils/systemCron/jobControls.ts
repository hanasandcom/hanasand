import { canRunApiCronJobNow, runApiCronJobNow, setApiCronJobPaused } from '../cron.ts'
import { DATABASE_BACKUP_JOB_ID, createDatabaseBackup, setDatabaseBackupSchedulePaused } from '../db/backups.ts'
import { managedCronDefinitions } from './managedDefinitions.ts'
import { readManagedCronState, listManagedCronJobs } from './managedCrontabState.ts'
import { normalizeSchedule, replaceManagedBlock } from '../systemCronCrontab.ts'
import { writeManagedCrontab } from '../managedCronHost.ts'
import { updateTiCollectionScheduler, runTiJob } from './tiJobControls.ts'
import type { ManagedCronUpdate } from './types.ts'
import { updateExternallyManagedCronJob, updatedScheduledJob } from './externalJobControls.ts'
import { VM_LIFECYCLE_MONITOR_JOB_ID } from '../vms/lifecycleMonitor.ts'
import { PROTECTED_LOG_PROCESSOR_JOB_IDS } from '../events/processor.ts'

export async function updateManagedCronJob(id: string, input: ManagedCronUpdate) {
    if (PROTECTED_LOG_PROCESSOR_JOB_IDS.has(id)) {
        throw new Error('Log processors cannot be paused, disabled, or changed through the scheduled-job API.')
    }
    if (id === 'ti-public-canary-collection') {
        await updateTiCollectionScheduler(input)
        return updatedScheduledJob(id)
    }
    if (id === 'ti-dwm-alert-generation' && input.action === 'run_now') {
        await runTiJob('/v1/dwm/alerts/rebuild', { tenantId: 'default', actor: 'dashboard/system/cron' })
        return updatedScheduledJob(id)
    }
    if (id === 'ti-source-pack-worker' && input.action === 'run_now') {
        await runTiJob('/v1/dwm/source-requests', { action: 'pack_worker_run', sourcePackLabel: 'default', requestedBy: 'dashboard/system/cron', reason: 'Run now requested from Cron Jobs dashboard.' })
        return updatedScheduledJob(id)
    }
    if (id === DATABASE_BACKUP_JOB_ID) {
        return updateExternallyManagedCronJob(id, input, {
            runNow: {
                run: () => createDatabaseBackup({ actorId: 'cron_dashboard', trigger: 'manual' }),
                label: 'database backup',
            },
            setPaused: setDatabaseBackupSchedulePaused,
        })
    }
    if (canRunApiCronJobNow(id)) {
        return updateExternallyManagedCronJob(id, input, {
            runNow: {
                run: () => runApiCronJobNow(id, { force: id === VM_LIFECYCLE_MONITOR_JOB_ID }),
                label: `API cron job ${id}`,
            },
            setPaused: paused => setApiCronJobPaused(id, paused),
        })
    }

    const definition = managedCronDefinitions.find(job => job.id === id)
    if (!definition) {
        throw new Error('Managed cron job not found or does not support controls.')
    }

    const schedule = input.schedule === undefined
        ? undefined
        : normalizeSchedule(input.schedule)
    const enabled = input.enabled === undefined
        ? undefined
        : Boolean(input.enabled)
    const { crontab, entries } = await readManagedCronState()
    const current = entries.get(id)
    entries.set(id, {
        schedule: schedule || current?.schedule || definition.defaultSchedule,
        enabled: enabled ?? current?.enabled ?? true,
    })

    await writeManagedCrontab(replaceManagedBlock(crontab, entries, managedCronDefinitions))
    return (await listManagedCronJobs()).find(job => job.id === id)!
}
