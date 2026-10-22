import { expect, mock, test } from 'bun:test'

mock.module('#constants', () => ({ default: { lxd_socket_path: '/run/lxd-prod/unix.socket' } }))
const purgeJobId = 'api-user-account-deletion'
const failoverJobId = 'api-vm-failover'
let paused = false
const runNowCalls: string[] = []

mock.module('../src/utils/events/rawLogRetention.ts', () => ({ RAW_LOG_RETENTION_JOB_ID: 'api-raw-log-retention' }))
mock.module('../src/utils/vms/collectMetrics.ts', () => ({ VM_METRICS_JOB_ID: 'api-vm-metrics' }))
mock.module('../src/utils/cron.ts', () => ({
    canRunApiCronJobNow: (id: string) => id === purgeJobId || id === failoverJobId,
    HOST_UPDATE_MONITOR_JOB_ID: 'api-host-update-monitor',
    isApiCronJobPaused: async() => paused,
    runApiCronJobNow: async(id: string) => { runNowCalls.push(id) },
    setApiCronJobPaused: async() => {},
}))
mock.module('../src/utils/organizationPrivacy.ts', () => ({ ORGANIZATION_RETENTION_JOB_ID: 'api-organization-retention' }))
mock.module('../src/utils/events/ruleStorageEstimateWorker.ts', () => ({ RULE_STORAGE_ESTIMATE_JOB_ID: 'api-rule-storage-estimate' }))
mock.module('../src/utils/auth/purgeDeletedAccounts.ts', () => ({ ACCOUNT_DELETION_PURGE_JOB_ID: purgeJobId }))
mock.module('../src/utils/vms/failover.ts', () => ({ VM_FAILOVER_JOB_ID: failoverJobId }))
mock.module('../src/utils/vms/lifecycleMonitor.ts', () => ({
    VM_LIFECYCLE_MONITOR_JOB_ID: 'api-vm-lifecycle-monitor',
    vmLifecycleMonitorIsConfigured: () => false,
}))
mock.module('../src/utils/vulnerabilities/scanner.ts', () => ({
    VULNERABILITY_SCAN_CADENCE_SECONDS: 3600,
    VULNERABILITY_SCAN_JOB_ID: 'api-vulnerability-scanner',
    getVulnerabilityReport: async() => ({ scanStatus: {
        enabled: true, paused: false, isRunning: false, schedule: 'Every hour', cadenceSeconds: 3600,
        nextRunAt: null, startedAt: null, finishedAt: null, lastSuccessAt: null, lastError: null,
        staleReason: null, blocker: null, blockerAction: null, failureCount: 0, targetCount: 0, logs: [],
    } }),
    setVulnerabilityScannerPaused: async() => {},
    startTrackedVulnerabilityScan: async() => {},
}))
mock.module('../src/utils/vulnerabilities/uvmScanner.ts', () => ({ UVM_SCHEDULE_JOB_ID: 'api-uvm-scheduled-scans' }))
mock.module('../src/utils/db/backups.ts', () => ({
    DATABASE_BACKUP_JOB_ID: 'api-database-backup',
    collectDatabaseBackupServices: async() => [{
        scheduleEnabled: false, schedule: '23 2 * * *', operations: [], currentOperation: null,
        nextBackup: null, lastError: null, error: null,
    }],
    createDatabaseBackup: async() => {},
    setDatabaseBackupSchedulePaused: async() => {},
}))
mock.module('../src/utils/managedCronHost.ts', () => ({
    readManagedCrontab: async() => [
        '# BEGIN HANASAND MANAGED CRON',
        '# id=forgejo-standby-sync',
        '*/15 * * * * command',
        '# id=forgejo-doctor',
        '0 9 * * 1-5 command',
        '# id=ti-threat-intel-backup',
        '0 0 1 * * command',
        '# END HANASAND MANAGED CRON',
    ].join('\n'),
    readManagedCronLog: async() => ({ line: null, createdAt: null }),
    writeManagedCrontab: async() => {},
}))

const { runTrackedBackgroundJob, getBackgroundJobRuntime } = await import('../src/utils/backgroundJobRuntime.ts')
const { cronCadenceSeconds, listUnifiedScheduledJobs, updateManagedCronJob } = await import('../src/utils/systemCron.ts')

test('host cron omits unverified forecasts and reports only fixed cadence intervals', async() => {
    expect(cronCadenceSeconds('* * * * *')).toBe(60)
    expect(cronCadenceSeconds('*/15 * * * *')).toBe(900)
    expect(cronCadenceSeconds('*/60 * * * *')).toBe(3600)
    expect(cronCadenceSeconds('*/7 * * * *')).toBeNull()
    expect(cronCadenceSeconds('23 2 * * *')).toBeNull()
    expect(cronCadenceSeconds('0 9 * * 1-5')).toBeNull()
    expect(cronCadenceSeconds('0 0 1 * *')).toBeNull()

    const jobs = await listUnifiedScheduledJobs()
    expect(jobs.find(job => job.id === 'forgejo-standby-sync')).toMatchObject({
        cadenceSeconds: 900,
        nextRunAt: null,
    })
    expect(jobs.find(job => job.id === 'forgejo-doctor')).toMatchObject({
        cadenceSeconds: null,
        nextRunAt: null,
    })
    expect(jobs.find(job => job.id === 'ti-threat-intel-backup')).toMatchObject({
        cadenceSeconds: null,
        nextRunAt: null,
    })
})
const { startLogProcessor } = await import('../src/utils/events/processor.ts')

test('registry reports a failed rerun while retaining the last successful result', async() => {
    await runTrackedBackgroundJob(purgeJobId, () => ({ purged: 1 }))
    const successfulRun = getBackgroundJobRuntime(purgeJobId)
    expect(successfulRun.lastSuccessAt).not.toBeNull()
    expect(successfulRun.lastError).toBeNull()

    await expect(runTrackedBackgroundJob(purgeJobId, () => { throw new Error('mail provider unavailable') }))
        .rejects.toThrow('mail provider unavailable')

    const failedRun = getBackgroundJobRuntime(purgeJobId)
    expect(failedRun).toMatchObject({ running: false, failureCount: 1, lastError: 'mail provider unavailable' })
    expect(failedRun.lastSuccessAt).toBe(successfulRun.lastSuccessAt)
    expect(failedRun.lastFinishedAt).not.toBeNull()

    const job = (await listUnifiedScheduledJobs()).find(item => item.id === purgeJobId)
    expect(job).toMatchObject({
        status: 'failed',
        enabled: true,
        running: false,
        failureCount: 1,
        lastSuccessAt: successfulRun.lastSuccessAt,
        lastError: 'mail provider unavailable',
    })

    paused = true
    const pausedJob = (await listUnifiedScheduledJobs()).find(item => item.id === purgeJobId)
    expect(pausedJob).toMatchObject({
        status: 'paused',
        enabled: false,
        nextRunAt: null,
        controls: ['resume', 'run_now'],
    })

    await updateManagedCronJob(purgeJobId, { action: 'run_now' })
    await Promise.resolve()
    expect(runNowCalls).toEqual([purgeJobId])
})

test('overlapping calls for one API job share a single tracked execution', async() => {
    const jobId = 'api-single-flight-test'
    let releaseWork!: (value: string) => void
    let calls = 0
    const work = () => {
        calls += 1
        return new Promise<string>(resolve => { releaseWork = resolve })
    }

    const first = runTrackedBackgroundJob(jobId, work)
    const second = runTrackedBackgroundJob(jobId, work)
    await Promise.resolve()

    expect(calls).toBe(1)
    expect(getBackgroundJobRuntime(jobId)).toMatchObject({ running: true, runCount: 0 })
    releaseWork('completed')
    expect(await Promise.all([first, second])).toEqual(['completed', 'completed'])
    expect(getBackgroundJobRuntime(jobId)).toMatchObject({ running: false, runCount: 1, failureCount: 0 })
})

test('VM failover is visible with minute cadence and safe API cron controls', async() => {
    paused = false
    const job = (await listUnifiedScheduledJobs()).find(item => item.id === failoverJobId)
    expect(job).toMatchObject({
        name: 'VM failover maintenance',
        schedule: 'Every minute',
        cadenceSeconds: 60,
        source: 'api/src/utils/vms/failover.ts',
        enabled: true,
        status: 'enabled',
        controls: ['pause', 'run_now'],
        controlMode: 'safe_control',
    })

    await updateManagedCronJob(failoverJobId, { action: 'run_now' })
    expect(runNowCalls).toContain(failoverJobId)

    paused = true
    const pausedJob = (await listUnifiedScheduledJobs()).find(item => item.id === failoverJobId)
    expect(pausedJob).toMatchObject({ enabled: false, status: 'paused', controls: ['resume', 'run_now'] })
})

test('staging lifecycle monitor hides controls without a configured target and preserves organization controls', async() => {
    const jobs = await listUnifiedScheduledJobs()
    const lifecycleJob = jobs.find(job => job.id === 'api-vm-lifecycle-monitor')
    const organizationJob = jobs.find(job => job.id === 'api-organization-retention')

    expect(lifecycleJob).toMatchObject({
        name: 'VM lifecycle staging monitor',
        controls: [],
        controlMode: 'observable_only',
    })
    expect(organizationJob?.controls).toEqual(['pause', 'resume', 'run_now'])
})

test('adaptive log processors report their batch runs without changing queue cadence', async() => {
    const jobId = 'api-test-log-processor'
    let notifyBatchStarted!: () => void
    const batchStarted = new Promise<void>(resolve => { notifyBatchStarted = resolve })
    const stop = startLogProcessor(async() => {
        notifyBatchStarted()
        return false
    }, () => {}, undefined, undefined, 5000, jobId)

    await batchStarted
    await stop()

    expect(getBackgroundJobRuntime(jobId)).toMatchObject({
        running: false,
        runCount: 1,
        failureCount: 0,
        lastSuccessAt: expect.any(String),
    })
})
