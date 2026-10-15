import { beforeEach, expect, mock, test } from 'bun:test'

let accountExists = true
let deletionScheduledAt: number | null = null
let mockNow = Date.now()
let scheduledTick: (() => Promise<void>) | undefined
let scheduleExpression = ''
const purgeJobId = 'api-user-account-deletion'
const tokenRevocations: Array<{ userId: string, revokedBy: string }> = []
const deletedFromUsers: string[] = []
const sqlCalls: string[] = []

async function query(sql: string, params: unknown[] = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    sqlCalls.push(normalized)
    if (normalized.startsWith('SELECT status FROM scheduled_job_controls')) {
        return { rows: [{ status: params[0] === purgeJobId ? 'enabled' : 'paused' }] }
    }
    if (normalized.startsWith('SELECT id FROM users WHERE id = $1 FOR UPDATE')) return { rows: accountExists ? [{ id: 'expired-user' }] : [] }
    if (normalized.startsWith('UPDATE users') && normalized.includes('deletion_scheduled_at = NOW() + INTERVAL \'30 days\'')) {
        deletionScheduledAt = mockNow + 30 * 24 * 60 * 60 * 1000
        return { rows: accountExists ? [{ id: 'expired-user', name: 'Expired User', avatar: null, active: true,
            deletion_requested_at: new Date(mockNow).toISOString(), deletion_scheduled_at: new Date(deletionScheduledAt).toISOString() }] : [] }
    }
    if (normalized.includes('COALESCE(NULLIF(u.email')) return { rows: [{ email: 'expired@example.test' }] }
    if (normalized.startsWith('SELECT COUNT(DISTINCT user_account.id)')) return { rows: [{ count: 0 }] }
    if (normalized.startsWith('SELECT user_account.id')) return { rows: accountIsDue() ? [{ id: 'expired-user' }] : [] }
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
    tryWithDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => ({ acquired: true, result: await work() }),
    withTransaction: async (work: (transactionQuery: typeof query) => Promise<unknown>) => work(query),
}))
mock.module('../src/utils/events/rawLogRetention.ts', () => ({ RAW_LOG_RETENTION_JOB_ID: 'api-raw-log-retention', retainRawLogs: async () => 0, retainTrafficLogs: async () => 0 }))
mock.module('../src/utils/caseDelivery.ts', () => ({ CASE_DELIVERY_JOB_ID: 'api-case-delivery', deliverCases: async () => ({ sent: 0 }) }))
mock.module('../src/utils/vms/deletion.ts', () => ({ maintainDeletedVms: async () => 0 }))
mock.module('../src/utils/vms/collectMetrics.ts', () => ({ default: async () => 0, VM_METRICS_JOB_ID: 'api-vm-metrics' }))
mock.module('../src/utils/mail/accounts.ts', () => ({ provisionExistingMailAccounts: async () => 0 }))
mock.module('../src/utils/mail/config.ts', () => ({ mailConfig: { adminPassword: '' } }))
mock.module('../src/utils/vms/ensureAlwaysRunning.ts', () => ({ default: async () => 0 }))
mock.module('../src/utils/automations.ts', () => ({ runDueAutomations: async () => 0 }))
mock.module('../src/utils/db/backups.ts', () => ({ DATABASE_BACKUP_JOB_ID: 'api-database-backup', runDueDatabaseBackup: async () => 0 }))
mock.module('../src/utils/organizationPrivacy.ts', () => ({ ORGANIZATION_RETENTION_JOB_ID: 'api-organization-retention', runOrganizationRetentionWorker: async () => ({ failed: 0 }) }))
mock.module('../src/utils/aptUpdates.ts', () => ({ persistHostUpdateStatus: async () => {}, readHostUpdateStatus: async () => ({}), updateHosts: [] }))
mock.module('../src/utils/events/ruleStorageEstimateWorker.ts', () => ({ RULE_STORAGE_ESTIMATE_JOB_ID: 'api-rule-storage-estimate', runRuleStorageEstimateWorker: async () => 0 }))
mock.module('../src/utils/systemCronMonitor.ts', () => ({ monitorSystemCronJobs: async () => ({ jobs: [] }) }))
mock.module('../src/utils/auth/session.ts', () => ({ revokeAllTokens: async (input: { userId: string, revokedBy: string }) => { tokenRevocations.push(input); return 1 } }))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({ deleteMailPrincipal: async () => {} }))
mock.module('../src/utils/auth/purgeUserSshKeys.ts', () => ({ purgeUserSshKeys: async () => 0 }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'expired-user', authenticatedId: 'expired-user', impersonating: false }) }))
mock.module('../src/utils/auth/accountDeletionMail.ts', () => ({ accountDeletionMail: () => ({ subject: 'Scheduled', textBody: 'Scheduled', htmlBody: 'Scheduled' }), deletionRequestLocation: async () => ({}) }))
mock.module('../src/utils/mail/system.ts', () => ({ sendSystemMail: async () => {} }))
mock.module('../src/utils/mail/helpers.ts', () => ({ addressForUser: () => 'expired@example.test' }))
mock.module('../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {}, userHasHanasandInternalAccess: async () => false }))

const { default: startCron } = await import('../src/utils/cron.ts')
const { getBackgroundJobRuntime, listBackgroundJobRuntime } = await import('../src/utils/backgroundJobRuntime.ts')
const { ACCOUNT_DELETION_PURGE_JOB_ID } = await import('../src/utils/auth/purgeDeletedAccounts.ts')
const { default: deleteSelf } = await import('../src/handlers/user/deleteSelf.ts')

beforeEach(() => {
    accountExists = true
    deletionScheduledAt = null
    mockNow = Date.now()
    scheduledTick = undefined
    scheduleExpression = ''
    tokenRevocations.length = 0
    deletedFromUsers.length = 0
    sqlCalls.length = 0
})

test('the minute scheduler runs the real account-purge worker without a login', async () => {
    const deleteReplyState: { statusCode: number, body?: any } = { statusCode: 200 }
    const deleteReply = {
        status(code: number) { deleteReplyState.statusCode = code; return deleteReply },
        send(body: unknown) { deleteReplyState.body = body; return deleteReply },
    }
    await deleteSelf({ headers: { 'user-agent': 'test' }, ip: '127.0.0.1' } as any, deleteReply as any)
    expect(deleteReplyState.statusCode).toBe(200)
    expect(accountExists).toBe(true)
    expect(deletedFromUsers).toEqual([])
    expect(tokenRevocations[0]).toEqual({ userId: 'expired-user', revokedBy: 'expired-user' })
    const scheduledAt = new Date(deleteReplyState.body.deletion_scheduled_at).getTime()
    expect(scheduledAt - mockNow).toBe(30 * 24 * 60 * 60 * 1000)

    startCron()
    expect(scheduleExpression).toBe('* * * * *')
    expect(scheduledTick).toBeDefined()

    await scheduledTick!()
    expect(accountExists).toBe(true)
    expect(deletedFromUsers).toEqual([])

    mockNow = scheduledAt + 1
    await scheduledTick!()

    expect(accountExists).toBe(false)
    expect(deletedFromUsers).toEqual(['expired-user'])
    expect(tokenRevocations).toEqual([
        { userId: 'expired-user', revokedBy: 'expired-user' },
        { userId: 'expired-user', revokedBy: 'expired-user' },
    ])
    expect(sqlCalls.some(sql => sql.startsWith('SELECT user_account.id') && sql.includes('deletion_scheduled_at <= NOW()'))).toBe(true)
    expect(sqlCalls.some(sql => sql.startsWith('DELETE FROM users') && sql.includes('deletion_scheduled_at <= NOW()'))).toBe(true)
    expect(listBackgroundJobRuntime().filter(job => job.runCount > 0).map(job => job.id)).toEqual([purgeJobId])
    expect(getBackgroundJobRuntime(purgeJobId).runCount).toBe(2)
    expect(getBackgroundJobRuntime(ACCOUNT_DELETION_PURGE_JOB_ID).lastSuccessAt).toBeTruthy()
})
