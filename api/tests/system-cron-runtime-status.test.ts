import { expect, mock, test } from 'bun:test'

const purgeJobId = 'api-user-account-deletion'
let paused = false

mock.module('../src/utils/events/rawLogRetention.ts', () => ({ RAW_LOG_RETENTION_JOB_ID: 'api-raw-log-retention' }))
mock.module('../src/utils/vms/collectMetrics.ts', () => ({ VM_METRICS_JOB_ID: 'api-vm-metrics' }))
mock.module('../src/utils/cron.ts', () => ({
    canRunApiCronJobNow: (id: string) => id === purgeJobId,
    HOST_UPDATE_MONITOR_JOB_ID: 'api-host-update-monitor',
    isApiCronJobPaused: async() => paused,
    runApiCronJobNow: async() => undefined,
    setApiCronJobPaused: async() => {},
}))
mock.module('../src/utils/organizationPrivacy.ts', () => ({ ORGANIZATION_RETENTION_JOB_ID: 'api-organization-retention' }))
mock.module('../src/utils/events/ruleStorageEstimateWorker.ts', () => ({ RULE_STORAGE_ESTIMATE_JOB_ID: 'api-rule-storage-estimate' }))
mock.module('../src/utils/auth/purgeDeletedAccounts.ts', () => ({ ACCOUNT_DELETION_PURGE_JOB_ID: purgeJobId }))
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
mock.module('../src/utils/db/backups.ts', () => ({
    DATABASE_BACKUP_JOB_ID: 'api-database-backup',
    collectDatabaseBackupServices: async() => [{
        scheduleEnabled: false, schedule: '23 2 * * *', operations: [], currentOperation: null,
        nextBackup: null, lastError: null, error: null,
    }],
    createDatabaseBackup: async() => {},
    setDatabaseBackupSchedulePaused: async() => {},
}))

const { runTrackedBackgroundJob, getBackgroundJobRuntime } = await import('../src/utils/backgroundJobRuntime.ts')
const { listUnifiedScheduledJobs } = await import('../src/utils/systemCron.ts')

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
})
