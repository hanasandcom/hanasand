import { expect, mock, test } from 'bun:test'

const purgeJobId = 'api-user-account-deletion'
let scheduledExpression = ''
let scheduledCallback: (() => Promise<void>) | undefined
let trackedJobs: string[] = []
let purgeRuns = 0

const noOp = async() => {}

mock.module('node-cron', () => ({
    schedule: (expression: string, callback: () => Promise<void>) => {
        scheduledExpression = expression
        scheduledCallback = callback
        return {}
    },
}))
mock.module('../src/utils/events/rawLogRetention.ts', () => ({ RAW_LOG_RETENTION_JOB_ID: 'raw-log-retention', retainRawLogs: noOp, retainTrafficLogs: noOp }))
mock.module('../src/utils/caseDelivery.ts', () => ({ CASE_DELIVERY_JOB_ID: 'case-delivery', deliverCases: noOp }))
mock.module('../src/utils/vms/deletion.ts', () => ({ maintainDeletedVms: noOp }))
mock.module('../src/utils/vms/collectMetrics.ts', () => ({ default: noOp, VM_METRICS_JOB_ID: 'vm-metrics' }))
mock.module('../src/utils/mail/accounts.ts', () => ({ provisionExistingMailAccounts: noOp }))
mock.module('../src/utils/mail/config.ts', () => ({ mailConfig: { adminPassword: undefined } }))
mock.module('../src/utils/vms/ensureAlwaysRunning.ts', () => ({ default: noOp }))
mock.module('../src/utils/automations.ts', () => ({ runDueAutomations: noOp }))
mock.module('../src/utils/db/backups.ts', () => ({ DATABASE_BACKUP_JOB_ID: 'database-backup', runDueDatabaseBackup: noOp }))
mock.module('#db', () => ({
    default: noOp,
    queryOnce: async (_sql: string, [id]: string[]) => ({ rows: [{ status: id === purgeJobId ? 'enabled' : 'paused' }] }),
}))
mock.module('../src/utils/organizationPrivacy.ts', () => ({ ORGANIZATION_RETENTION_JOB_ID: 'organization-retention', runOrganizationRetentionWorker: noOp }))
mock.module('../src/utils/aptUpdates.ts', () => ({ persistHostUpdateStatus: noOp, readHostUpdateStatus: noOp, updateHosts: [] }))
mock.module('../src/utils/events/ruleStorageEstimateWorker.ts', () => ({ RULE_STORAGE_ESTIMATE_JOB_ID: 'rule-storage-estimate', runRuleStorageEstimateWorker: noOp }))
mock.module('../src/utils/auth/purgeDeletedAccounts.ts', () => ({
    ACCOUNT_DELETION_PURGE_JOB_ID: purgeJobId,
    default: async() => { purgeRuns++ },
}))
mock.module('../src/utils/backgroundJobRuntime.ts', () => ({
    getBackgroundJobRuntime: () => ({ running: false }),
    runTrackedBackgroundJob: async(id: string, runner: () => Promise<unknown> | unknown) => {
        trackedJobs.push(id)
        return runner()
    },
}))

const { default: cron } = await import('../src/utils/cron.ts')

test('the minute scheduler dispatches account purge through the tracked runner', async() => {
    trackedJobs = []
    purgeRuns = 0
    scheduledCallback = undefined

    cron()

    expect(scheduledExpression).toBe('* * * * *')
    expect(scheduledCallback).toBeDefined()
    await scheduledCallback?.()

    expect(trackedJobs).toEqual([purgeJobId])
    expect(purgeRuns).toBe(1)
})
