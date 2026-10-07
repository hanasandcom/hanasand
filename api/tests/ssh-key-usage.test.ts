import { beforeEach, expect, mock, test } from 'bun:test'
import { invalidateReadCache } from '../src/utils/readCache.ts'
import { normalizeHostPublicKey } from '../src/utils/hostSsh.ts'

const publicBlob = Buffer.concat([
    Buffer.from([0, 0, 0, 11]), Buffer.from('ssh-ed25519'),
    Buffer.from([0, 0, 0, 32]), Buffer.alloc(32, 17),
])
const publicKey = `ssh-ed25519 ${publicBlob.toString('base64')} test-key`
const fingerprint = normalizeHostPublicKey(publicKey)!.fingerprint
let keyRows: Array<{ user_id: string, key_id: number, public_key: string, username: string }> = []
let inserts: Array<{ sql: string, params: unknown[] }> = []

const identityQuery = async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM certificates c')) return { rows: keyRows, rowCount: keyRows.length }
    if (sql.includes('INSERT INTO ssh_key_usage_latest')) {
        inserts.push({ sql, params })
        return { rows: [], rowCount: 1 }
    }
    throw new Error(`Unexpected Identity SQL: ${sql}`)
}

mock.module('#db', () => ({ identityQueryOnce: identityQuery }))

const { recordProfileSshKeyUsageFromEvents } = await import('../src/utils/sshKeyUsage.ts')

beforeEach(() => {
    keyRows = [{ user_id: 'eirikhanasand', key_id: 42, public_key: publicKey, username: 'eirikhanasand' }]
    inserts = []
    invalidateReadCache('profile-ssh-key-usage-index:')
})

function event(overrides: Record<string, unknown> = {}) {
    return {
        event_type: 'authentication',
        action: 'login',
        outcome: 'success',
        timestamp: '2026-10-07T09:30:00.000Z',
        host: 'ovhcloud',
        service: 'sshd',
        message: `Accepted publickey for eirikhanasand from 203.0.113.9 port 42000 ssh2: ED25519 ${fingerprint}`,
        source: { ip: '203.0.113.9' },
        metadata: {},
        ...overrides,
    }
}

test('records only the latest key use per server with minimal Identity metadata', async () => {
    const count = await recordProfileSshKeyUsageFromEvents([
        event({ timestamp: '2026-10-07T09:20:00.000Z' }),
        event({ timestamp: '2026-10-07T09:30:00.000Z', metadata: { user_agent: 'OpenSSH_9.9' } }),
        event({ host: 'inspur', timestamp: '2026-10-07T09:25:00.000Z' }),
    ], identityQuery)

    expect(count).toBe(2)
    expect(inserts).toHaveLength(1)
    expect(inserts[0].sql).toContain('GREATEST(ssh_key_usage_latest.last_used_at, EXCLUDED.last_used_at)')
    const records = JSON.parse(String(inserts[0].params[0]))
    expect(records).toEqual(expect.arrayContaining([
        {
            user_id: 'eirikhanasand', key_id: 42, server_app: 'ovh/sshd',
            user_agent: 'OpenSSH_9.9', ip_address: '203.0.113.9', last_used_at: '2026-10-07T09:30:00.000Z',
        },
        {
            user_id: 'eirikhanasand', key_id: 42, server_app: 'inspur/sshd',
            user_agent: null, ip_address: '203.0.113.9', last_used_at: '2026-10-07T09:25:00.000Z',
        },
    ]))
    expect(Object.keys(records[0]).sort()).toEqual(['ip_address', 'key_id', 'last_used_at', 'server_app', 'user_agent', 'user_id'].sort())
})

test('ignores failed logins, unrelated servers, and keys without a clear owner', async () => {
    keyRows.push({ user_id: 'other-user', key_id: 43, public_key: publicKey, username: 'other-user' })
    const count = await recordProfileSshKeyUsageFromEvents([
        event({ outcome: 'failure' }),
        event({ host: 'unmanaged' }),
        event({ message: `Accepted publickey for unknown-user from 203.0.113.9 port 42000 ssh2: ED25519 ${fingerprint}` }),
    ], identityQuery)

    expect(count).toBe(0)
    expect(inserts).toHaveLength(0)
})
