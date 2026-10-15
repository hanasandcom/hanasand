import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { canRunApiCronJobNow } from '../src/utils/cron.ts'
import { ACCOUNT_DELETION_PURGE_JOB_ID } from '../src/utils/auth/purgeDeletedAccounts.ts'
import { scheduledJobRegistryGuardrailEntries } from '../src/utils/systemCron.ts'

const deleteUser = await readFile(new URL('../src/handlers/user/deleteUser.ts', import.meta.url), 'utf8')
const deleteSelf = await readFile(new URL('../src/handlers/user/deleteSelf.ts', import.meta.url), 'utf8')
const login = await readFile(new URL('../src/handlers/auth/login.ts', import.meta.url), 'utf8')
const purge = await readFile(new URL('../src/utils/auth/purgeDeletedAccounts.ts', import.meta.url), 'utf8')

for (const source of [deleteUser, deleteSelf]) {
    assert.match(source, /UPDATE users/)
    assert.match(source, /deletion_requested_at = NOW\(\)/)
    assert.match(source, /deletion_scheduled_at = NOW\(\) \+ INTERVAL '30 days'/)
    assert.match(source, /revokeAllTokens/)
    assert.doesNotMatch(source, /DELETE FROM users/, 'user-facing delete handlers should schedule deletion, not hard-delete immediately')
}

assert.match(deleteUser, /id: actorId/)
assert.match(deleteUser, /revokedBy: actorId/)
assert.match(deleteSelf, /revokedBy: id/)
assert.match(login, /purgeDeletedAccount\(userId\)/)
assert.match(login, /Account pending deletion\./)
assert.match(login, /status\(423\)/)
assert.match(purge, /deletion_scheduled_at <= NOW\(\)/)
assert.match(purge, /FOR UPDATE/)
assert.match(purge, /DELETE FROM tokens/)
assert.match(purge, /DELETE FROM login_events/)
assert.match(purge, /DELETE FROM attempts/)
assert.match(purge, /DELETE FROM article_ownership/)
assert.match(purge, /deleteMailPrincipal/)

assert.equal(canRunApiCronJobNow(ACCOUNT_DELETION_PURGE_JOB_ID), true, 'account deletion must have a registered cron runner')
assert.ok(scheduledJobRegistryGuardrailEntries().some(entry =>
    entry.id === ACCOUNT_DELETION_PURGE_JOB_ID && entry.source === 'api/src/utils/auth/purgeDeletedAccounts.ts'
), 'account deletion worker must be visible in the scheduled-job registry')

console.log('User deletion contract smoke passed for 30-day scheduling, automatic purge registration, and login enforcement.')
