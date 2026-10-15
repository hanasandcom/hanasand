import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const deleteUser = await readFile(new URL('../src/handlers/user/deleteUser.ts', import.meta.url), 'utf8')
const deleteSelf = await readFile(new URL('../src/handlers/user/deleteSelf.ts', import.meta.url), 'utf8')
const login = await readFile(new URL('../src/handlers/auth/login.ts', import.meta.url), 'utf8')

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
assert.match(login, /bcrypt\.compare\(password, user\.password\)/)
assert.match(login, /deletion_scheduled_at.*Date\.now\(\)/s)
assert.match(login, /DELETE FROM users WHERE id = \$1/)
assert.match(login, /Account pending deletion\./)
assert.match(login, /status\(423\)/)

console.log('User deletion contract smoke passed for scheduled deletion and login enforcement.')
