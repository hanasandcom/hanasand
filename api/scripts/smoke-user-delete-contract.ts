import assert from 'node:assert/strict'
import { canRunApiCronJobNow } from '../src/utils/cron.ts'
import { ACCOUNT_DELETION_PURGE_JOB_ID } from '../src/utils/auth/purgeDeletedAccounts.ts'
import { scheduledJobRegistryGuardrailEntries } from '../src/utils/systemCron.ts'

assert.equal(canRunApiCronJobNow(ACCOUNT_DELETION_PURGE_JOB_ID), true, 'account deletion must have a registered cron runner')
assert.ok(scheduledJobRegistryGuardrailEntries().some(entry =>
    entry.id === ACCOUNT_DELETION_PURGE_JOB_ID && entry.source === 'api/src/utils/auth/purgeDeletedAccounts.ts'
), 'account deletion worker must be visible in the scheduled-job registry')

console.log('User deletion contract smoke passed for automatic purge runner registration.')
