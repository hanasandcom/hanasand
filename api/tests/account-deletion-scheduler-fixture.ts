import { mock } from 'bun:test'

export let accountExists = true
let deletionScheduledAt: number | null = null
export let mockNow = Date.now()
export let scheduledTick: (() => Promise<void>) | undefined
export let scheduleExpression = ''
export const purgeJobId = 'api-user-account-deletion'
export const tokenRevocations: Array<{ userId: string, revokedBy: string }> = []
export const deletedFromUsers: string[] = []
export const deletionAuditEvents: Array<Record<string, unknown>> = []
export const sqlCalls: string[] = []
export let databaseBackupPolls = 0
export let purgePaused = false
export const failoverJobId = 'api-vm-failover'
export let failoverPaused = true
export let failoverRuns = 0

async function query(sql: string, params: unknown[] = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    sqlCalls.push(normalized)
    if (normalized.startsWith('SELECT status FROM scheduled_job_controls')) {
        const enabled = (params[0] === purgeJobId && !purgePaused) || (params[0] === failoverJobId && !failoverPaused)
        return { rows: [{ status: enabled ? 'enabled' : 'paused' }] }
    }
    if (normalized.startsWith('SELECT id FROM users WHERE id = $1 FOR UPDATE')) return { rows: accountExists ? [{ id: 'expired-user' }] : [] }
    if (normalized.startsWith('UPDATE users') && normalized.includes('deletion_scheduled_at = NOW() + INTERVAL \'30 days\'')) {
        deletionScheduledAt = mockNow + 30 * 24 * 60 * 60 * 1000
        return { rows: accountExists ? [{ id: 'expired-user', name: 'Expired User', avatar: null, active: true,
            deletion_requested_at: new Date(mockNow).toISOString(), deletion_scheduled_at: new Date(deletionScheduledAt).toISOString() }] : [] }
    }
    if (normalized.includes('COALESCE(NULLIF(u.email')) return { rows: [{ email: 'expired@example.test' }] }
    if (normalized.startsWith('SELECT COUNT(DISTINCT user_account.id)')) return { rows: [{ count: 0 }] }
    if (normalized.startsWith('WITH eligible_accounts') && normalized.includes('FROM users user_account')) {
        return { rows: accountIsDue() ? [{ id: 'expired-user' }] : [] }
    }
    if (normalized.startsWith('SELECT id, name, email FROM users')) {
        return { rows: accountIsDue() && params[0] === 'expired-user' ? [{ id: 'expired-user', name: 'Expired User', email: 'expired@example.test' }] : [] }
    }
    if (normalized.startsWith('DELETE FROM users')) {
        if (accountIsDue() && params[0] === 'expired-user') {
            accountExists = false
            deletedFromUsers.push(String(params[0]))
            return { rows: [{ id: 'expired-user' }] }
        }
    }
    return { rows: [] }
}

function accountIsDue() {
    return accountExists && deletionScheduledAt !== null && deletionScheduledAt <= mockNow
}

mock.module('node-cron', () => ({ schedule: (expression: string, callback: () => Promise<void>) => {
    scheduleExpression = expression
    scheduledTick = callback
    return {}
} }))
mock.module('#db', () => ({
    default: query,
    queryOnce: query,
    identityQueryOnce: async () => ({ rows: [] }),
    withDatabaseAdvisoryLock: async (_key: string, work: (transactionQuery: typeof query) => Promise<unknown>) => work(query),
    tryWithDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => ({ acquired: true, result: await work() }),
    withTransaction: async (work: (transactionQuery: typeof query) => Promise<unknown>) => work(query),
}))
mock.module('../src/utils/events/rawLogRetention.ts', () => ({ RAW_LOG_RETENTION_JOB_ID: 'api-raw-log-retention', retainRawLogs: async () => 0, retainTrafficLogs: async () => 0 }))
mock.module('../src/utils/logs/logOutboxConfig.ts', () => ({
    shouldRunLegacyLogProcessing: () => process.env.LOGS_OUTBOX_REMOTE_ONLY !== '1',
}))
mock.module('../src/utils/caseDelivery.ts', () => ({ CASE_DELIVERY_JOB_ID: 'api-case-delivery', deliverCases: async () => ({ sent: 0 }) }))
mock.module('../src/utils/vms/deletion.ts', () => ({ maintainDeletedVms: async () => 0 }))
mock.module('../src/utils/vms/collectMetrics.ts', () => ({ default: async () => 0, VM_METRICS_JOB_ID: 'api-vm-metrics' }))
mock.module('../src/utils/mail/accounts.ts', () => ({ provisionExistingMailAccounts: async () => 0 }))
mock.module('../src/utils/mail/config.ts', () => ({ mailConfig: { adminPassword: '' } }))
mock.module('../src/utils/vms/ensureAlwaysRunning.ts', () => ({ default: async () => 0 }))
mock.module('../src/utils/vms/lifecycleMonitor.ts', () => ({
    monitorVmLifecycle: async () => null,
    vmLifecycleMonitorIsConfigured: () => process.env.VM_LIFECYCLE_MONITOR_ENABLED === 'true'
        && process.env.VM_LIFECYCLE_MONITOR_TARGET === 'isolated-staging'
        && process.env.VM_LIFECYCLE_MONITOR_SOCKET_PATH !== '/run/lxd-prod/unix.socket'
        && Boolean(process.env.VM_LIFECYCLE_MONITOR_SOCKET_PATH && process.env.VM_LIFECYCLE_MONITOR_IMAGE_SERVER && process.env.VM_LIFECYCLE_MONITOR_IMAGE_ALIAS),
    VM_LIFECYCLE_MONITOR_JOB_ID: 'api-vm-lifecycle-monitor',
}))
mock.module('../src/utils/automations.ts', () => ({ runDueAutomations: async () => 0 }))
mock.module('../src/utils/db/backups.ts', () => ({
    DATABASE_BACKUP_JOB_ID: 'api-database-backup',
    collectDatabaseBackupServices: async () => [],
    createDatabaseBackup: async () => null,
    runDueDatabaseBackup: async () => { databaseBackupPolls += 1; return 0 },
    setDatabaseBackupSchedulePaused: async () => {},
}))
mock.module('../src/utils/organizationPrivacy.ts', () => ({ ORGANIZATION_RETENTION_JOB_ID: 'api-organization-retention', runOrganizationRetentionWorker: async () => ({ failed: 0 }) }))
mock.module('../src/utils/aptUpdates.ts', () => ({ persistHostUpdateStatus: async () => {}, readHostUpdateStatus: async () => ({}), updateHosts: [] }))
mock.module('../src/utils/events/ruleStorageEstimateWorker.ts', () => ({ RULE_STORAGE_ESTIMATE_JOB_ID: 'api-rule-storage-estimate', runRuleStorageEstimateWorker: async () => 0 }))
mock.module('../src/utils/systemCronMonitor.ts', () => ({ monitorSystemCronJobs: async () => ({ jobs: [] }) }))
mock.module('../src/utils/auth/session.ts', () => ({ revokeAllTokens: async (input: { userId: string, revokedBy: string }) => { tokenRevocations.push(input); return 1 } }))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({ deleteMailPrincipal: async () => {} }))
mock.module('../src/utils/auth/purgeUserSshKeys.ts', () => ({ purgeUserSshKeys: async () => 0 }))
mock.module('../src/utils/vms/failover.ts', () => ({
    VM_FAILOVER_JOB_ID: failoverJobId,
    maintainVmFailover: async() => { failoverRuns++; return { processed: 1 } },
}))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'expired-user', authenticatedId: 'expired-user', impersonating: false }) }))
mock.module('../src/utils/auth/accountDeletionMail.ts', () => ({ accountDeletionMail: () => ({ subject: 'Scheduled', textBody: 'Scheduled', htmlBody: 'Scheduled' }), deletionRequestLocation: async () => ({}) }))
mock.module('../src/utils/mail/system.ts', () => ({ sendSystemMail: async () => {} }))
mock.module('../src/utils/mail/helpers.ts', () => ({ addressForUser: () => 'expired@example.test' }))
mock.module('../src/utils/systemEvent.ts', () => ({
    recordSystemEvent: async (_req: unknown, event: Record<string, unknown>) => { deletionAuditEvents.push(event) },
    userHasHanasandInternalAccess: async () => false,
}))

export const { default: startCron, canRunApiCronJobNow } = await import('../src/utils/cron.ts')
export const { getBackgroundJobRuntime, listBackgroundJobRuntime } = await import('../src/utils/backgroundJobRuntime.ts')
export const { ACCOUNT_DELETION_PURGE_JOB_ID } = await import('../src/utils/auth/purgeDeletedAccounts.ts')
export const { scheduledJobRegistryGuardrailEntries } = await import('../src/utils/systemCron.ts')
export const { default: deleteSelf } = await import('../src/handlers/user/deleteSelf.ts')

export function resetAccountDeletionSchedulerState() {
    accountExists = true
    deletionScheduledAt = null
    mockNow = Date.now()
    scheduledTick = undefined
    scheduleExpression = ''
    tokenRevocations.length = 0
    deletedFromUsers.length = 0
    deletionAuditEvents.length = 0
    sqlCalls.length = 0
    databaseBackupPolls = 0
    purgePaused = false
    failoverPaused = true
    failoverRuns = 0
}

export function setMockNow(value: number) { mockNow = value }
export function setPurgePaused(value: boolean) { purgePaused = value }
export function setFailoverPaused(value: boolean) { failoverPaused = value }
