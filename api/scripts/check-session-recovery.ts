import assert from 'node:assert/strict'
const previousToken = process.env.HANASAND_IDENTITY_SERVICE_TOKEN
const previousFetch = globalThis.fetch
let replica = true
let writes = 0
const timestamp = new Date(Date.now() - 3600_000).toISOString()
process.env.HANASAND_IDENTITY_SERVICE_TOKEN = 'disposable-session-recovery-test-token'
globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body || '{}')) as { operation?: string, id?: string, token?: string }
    assert.equal(request.operation, 'validate')
    assert.equal(request.id, 'probe')
    assert.equal(request.token, 'test-token')
    if (!replica) writes++
    return new Response(JSON.stringify({
        user: { id: 'probe', name: 'Probe', avatar: '', active: true },
        session: { token_id: 1, id: 'probe', token: 'test-token', ip: '127.0.0.1', user_agent: 'Browser', created_at: timestamp, timestamp, database_read_only: replica },
        refreshed: { token: 'test-token', expires_at: new Date(Date.parse(timestamp) + 24 * 3600_000).toISOString() },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
}
const { validateSession } = await import('../src/utils/auth/session.ts')
try {
    const recovered = await validateSession({ id: 'probe', token: 'test-token' })
    assert(recovered)
    assert.equal(recovered.user.id, 'probe')
    assert.equal(Object.hasOwn(recovered, 'roles'), false)
    assert.equal(recovered.session.database_read_only, true, 'Identity replica state is preserved before monitor convergence')
    assert.equal(writes, 0, 'Replica validation does not write')
    assert.equal(Date.parse(recovered.refreshed.expires_at), Date.parse(timestamp) + 24 * 3600_000)
    replica = false
    assert((await validateSession({ id: 'probe', token: 'test-token' }))?.session.database_read_only === false)
    assert.equal(writes, 1, 'Primary validation resumes normal session refresh')
    console.log('Identity replica session state preserves hard expiry and resumes refresh after recovery.')
} finally {
    globalThis.fetch = previousFetch
    if (previousToken === undefined) delete process.env.HANASAND_IDENTITY_SERVICE_TOKEN
    else process.env.HANASAND_IDENTITY_SERVICE_TOKEN = previousToken
}
