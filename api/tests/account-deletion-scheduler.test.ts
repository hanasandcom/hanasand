import { beforeEach, expect, test } from 'bun:test'
import {
    ACCOUNT_DELETION_PURGE_JOB_ID, accountExists, canRunApiCronJobNow, databaseBackupPolls,
    deletionAuditEvents, deletedFromUsers, failoverJobId,
    failoverRuns, getBackgroundJobRuntime, listBackgroundJobRuntime, mockNow,
    purgeJobId, resetAccountDeletionSchedulerState, scheduledJobRegistryGuardrailEntries,
    setFailoverPaused, setMockNow, setPurgePaused,
    scheduledTick, scheduleExpression, sqlCalls, startCron, tokenRevocations, deleteSelf,
} from './account-deletion-scheduler-fixture.ts'

beforeEach(resetAccountDeletionSchedulerState)

test('the minute scheduler purges accounts without login or external backup polling', async () => {
    expect(canRunApiCronJobNow(ACCOUNT_DELETION_PURGE_JOB_ID)).toBe(true)
    expect(scheduledJobRegistryGuardrailEntries().some(entry =>
        entry.id === ACCOUNT_DELETION_PURGE_JOB_ID
            && entry.source === 'api/src/utils/auth/purgeDeletedAccounts.ts'
    )).toBe(true)
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
    expect(deletionAuditEvents).toEqual([{
        actionType: 'user.account.deleted',
        actorId: 'expired-user',
        source: 'auth',
        targetType: 'user',
        targetId: 'expired-user',
        severity: 'warning',
        context: { deletionMode: 'scheduled', targetName: 'Expired User', targetId: 'expired-user', hanasandOrganizationMember: false },
    }])
    const scheduledAt = new Date(deleteReplyState.body.deletion_scheduled_at).getTime()
    expect(scheduledAt - mockNow).toBe(30 * 24 * 60 * 60 * 1000)

    startCron()
    expect(scheduleExpression).toBe('* * * * *')
    expect(scheduledTick).toBeDefined()

    await scheduledTick!()
    expect(accountExists).toBe(true)
    expect(deletedFromUsers).toEqual([])
    expect(databaseBackupPolls).toBe(0)

    setMockNow(scheduledAt)
    setPurgePaused(true)
    await scheduledTick!()
    expect(accountExists).toBe(true)
    expect(deletedFromUsers).toEqual([])
    expect(getBackgroundJobRuntime(purgeJobId).runCount).toBe(1)

    setPurgePaused(false)
    await scheduledTick!()

    expect(accountExists).toBe(false)
    expect(deletedFromUsers).toEqual(['expired-user'])
    expect(databaseBackupPolls).toBe(0)
    expect(tokenRevocations).toEqual([
        { userId: 'expired-user', revokedBy: 'expired-user' },
        { userId: 'expired-user', revokedBy: 'expired-user' },
    ])
    expect(sqlCalls.some(sql => sql.startsWith('WITH eligible_accounts') && sql.includes('deletion_scheduled_at <= NOW()'))).toBe(true)
    expect(sqlCalls.some(sql => sql.startsWith('DELETE FROM users') && sql.includes('deletion_scheduled_at <= NOW()'))).toBe(true)
    expect(listBackgroundJobRuntime().filter(job => job.runCount > 0).map(job => job.id)).toEqual([purgeJobId])
    expect(getBackgroundJobRuntime(purgeJobId).runCount).toBe(2)
    expect(getBackgroundJobRuntime(ACCOUNT_DELETION_PURGE_JOB_ID).lastSuccessAt).toBeTruthy()
})

test('the minute cron dispatches VM failover maintenance and records worker runtime', async () => {
    const { VM_FAILOVER_JOB_ID } = await import('../src/utils/vms/failover.ts')
    expect(VM_FAILOVER_JOB_ID).toBe(failoverJobId)
    expect(canRunApiCronJobNow(VM_FAILOVER_JOB_ID)).toBe(true)
    expect(scheduledJobRegistryGuardrailEntries().some(entry =>
        entry.id === VM_FAILOVER_JOB_ID && entry.source === 'api/src/utils/vms/failover.ts'
    )).toBe(true)

    startCron()
    expect(scheduleExpression).toBe('* * * * *')
    await scheduledTick!()
    expect(failoverRuns).toBe(0)

    setFailoverPaused(false)
    await scheduledTick!()

    expect(failoverRuns).toBe(1)
    expect(getBackgroundJobRuntime(VM_FAILOVER_JOB_ID)).toMatchObject({
        running: false,
        runCount: 1,
        failureCount: 0,
        lastError: null,
        lastSuccessAt: expect.any(String),
    })
})

test('the VM lifecycle monitor cron is unavailable without isolated staging settings', () => {
    const VM_LIFECYCLE_MONITOR_JOB_ID = 'api-vm-lifecycle-monitor'
    const keys = [
        'VM_LIFECYCLE_MONITOR_ENABLED',
        'VM_LIFECYCLE_MONITOR_TARGET',
        'VM_LIFECYCLE_MONITOR_SOCKET_PATH',
        'VM_LIFECYCLE_MONITOR_IMAGE_SERVER',
        'VM_LIFECYCLE_MONITOR_IMAGE_ALIAS',
    ] as const
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
    try {
        keys.forEach(key => { delete process.env[key] })
        expect(canRunApiCronJobNow(VM_LIFECYCLE_MONITOR_JOB_ID)).toBe(false)
        process.env.VM_LIFECYCLE_MONITOR_ENABLED = 'true'
        process.env.VM_LIFECYCLE_MONITOR_TARGET = 'production'
        process.env.VM_LIFECYCLE_MONITOR_SOCKET_PATH = '/run/lxd-prod/unix.socket'
        process.env.VM_LIFECYCLE_MONITOR_IMAGE_SERVER = 'https://images.example.test/releases'
        process.env.VM_LIFECYCLE_MONITOR_IMAGE_ALIAS = '24.04'
        expect(canRunApiCronJobNow(VM_LIFECYCLE_MONITOR_JOB_ID)).toBe(false)
        process.env.VM_LIFECYCLE_MONITOR_TARGET = 'isolated-staging'
        expect(canRunApiCronJobNow(VM_LIFECYCLE_MONITOR_JOB_ID)).toBe(false)
        process.env.VM_LIFECYCLE_MONITOR_SOCKET_PATH = '/run/lxd-staging/unix.socket'
        expect(canRunApiCronJobNow(VM_LIFECYCLE_MONITOR_JOB_ID)).toBe(true)
    } finally {
        keys.forEach(key => {
            if (previous[key] === undefined) delete process.env[key]
            else process.env[key] = previous[key]
        })
    }
})

test('legacy log cleanup and rule estimate jobs are unavailable in remote-only Logs mode', () => {
    const previous = process.env.LOGS_OUTBOX_REMOTE_ONLY
    try {
        delete process.env.LOGS_OUTBOX_REMOTE_ONLY
        expect(canRunApiCronJobNow('api-raw-log-retention')).toBe(true)
        expect(canRunApiCronJobNow('api-rule-storage-estimate')).toBe(true)

        process.env.LOGS_OUTBOX_REMOTE_ONLY = '1'
        expect(canRunApiCronJobNow('api-raw-log-retention')).toBe(false)
        expect(canRunApiCronJobNow('api-rule-storage-estimate')).toBe(false)
        expect(canRunApiCronJobNow(ACCOUNT_DELETION_PURGE_JOB_ID)).toBe(true)
    } finally {
        if (previous === undefined) delete process.env.LOGS_OUTBOX_REMOTE_ONLY
        else process.env.LOGS_OUTBOX_REMOTE_ONLY = previous
    }
})
