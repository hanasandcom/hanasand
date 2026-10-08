import { beforeEach, expect, mock, test } from 'bun:test'

let userId = 'profile-test-user'
let certificateRows: Array<{
    id: number
    name: string
    public_key: string
    added_at: string
    last_used_at: string | null
    last_used_server_app: string | null
    last_used_ip_address: string | null
    last_used_user_agent: string | null
}> = []
let keyQuery = ''
let keyParams: unknown[] = []

const fingerprint = (name: string) => `SHA256:${name.padEnd(43, 'A')}`
const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM certificates c')) {
        keyQuery = sql
        keyParams = params
        return { rows: certificateRows }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
}

mock.module('#db', () => ({
    default: query,
    identityQueryOnce: query,
    withIdentityAdvisoryLock: async (_key: string, work: () => unknown) => work(),
    withIdentityTransaction: async (work: (run: typeof query) => unknown) => work(query),
}))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: userId, authenticatedId: userId }) }))
mock.module('#utils/hostSsh.ts', () => ({
    applyManagedHostSshKeys: async () => {},
    normalizeHostPublicKey: (value: unknown) => {
        if (typeof value !== 'string') return null
        const [keyType, encoded, name] = value.split(' ')
        if (!keyType || !encoded || !name) return null
        return { publicKey: `${keyType} ${encoded}`, fingerprint: fingerprint(name) }
    },
}))

const { getProfileSshKeys } = await import('../src/handlers/profileSshKeys.ts')

beforeEach(() => {
    userId = `profile-test-${crypto.randomUUID()}`
    certificateRows = []
    keyQuery = ''
    keyParams = []
})

async function getKeys() {
    const reply = {
        body: undefined as unknown,
        header() { return this },
        status() { return this },
        send(body: unknown) { this.body = body; return body },
    }
    await getProfileSshKeys({ log: { error() {} } } as never, reply as never)
    return reply.body as { keys: Array<{
        addedAt: string
        fingerprint: string
        lastUsedAt: string | null
        lastUsedServer: string | null
        lastUsedIp: string | null
        lastUsedUserAgent: string | null
    }> }
}

test('profile SSH key usage keeps the recorded time even before the assigned date', async () => {
    const addedAt = '2026-10-01T14:09:31.000Z'
    const lastUsedAt = '2026-09-30T22:14:51.000Z'
    certificateRows = [{
        id: 7,
        name: 'historical',
        public_key: 'ssh-ed25519 encoded historical',
        added_at: addedAt,
        last_used_at: lastUsedAt,
        last_used_server_app: 'inspur/sshd',
        last_used_ip_address: '203.0.113.9',
        last_used_user_agent: 'OpenSSH_9.9',
    }]

    const result = await getKeys()

    expect(result.keys[0]?.lastUsedAt).toBe(lastUsedAt)
    expect(keyQuery).toContain('FROM ssh_key_usage_latest')
    expect(keyQuery).toContain('LEFT JOIN LATERAL')
    expect(keyQuery).toContain('ORDER BY key_use.last_used_at DESC, key_use.server_app')
    expect(result.keys[0]).toMatchObject({ lastUsedServer: 'inspur/sshd', lastUsedIp: '203.0.113.9', lastUsedUserAgent: 'OpenSSH_9.9' })
    expect(keyParams).toEqual([userId])
})

test('profile SSH key usage comes from Identity by key ID', async () => {
    const addedAt = '2026-10-01T14:09:31.000Z'
    const lastUsedAt = '2026-10-06T03:01:25.000Z'
    certificateRows = [{
        id: 8,
        name: 'ovh-key',
        public_key: 'ssh-ed25519 encoded ovh-key',
        added_at: addedAt,
        last_used_at: lastUsedAt,
        last_used_server_app: 'ovh/sshd',
        last_used_ip_address: '203.0.113.10',
        last_used_user_agent: null,
    }]

    const result = await getKeys()

    expect(result.keys[0]?.lastUsedAt).toBe(lastUsedAt)
    expect(result.keys[0]).toMatchObject({ lastUsedServer: 'ovh/sshd', lastUsedIp: '203.0.113.10', lastUsedUserAgent: null })
    expect(keyQuery).not.toContain('MAX(key_use.last_used_at)')
    expect(keyParams).toEqual([userId])
})

test('profile SSH key shows an empty last-used date when there is no Identity usage row', async () => {
    const addedAt = '2026-09-19T11:30:00.214Z'
    certificateRows = [{
        id: 9,
        name: 'inspur-key',
        public_key: 'ssh-ed25519 encoded inspur-key',
        added_at: addedAt,
        last_used_at: null,
        last_used_server_app: null,
        last_used_ip_address: null,
        last_used_user_agent: null,
    }]

    const result = await getKeys()

    expect(result.keys[0]?.lastUsedAt).toBeNull()
    expect(result.keys[0]).toMatchObject({
        id: 9,
        addedAt,
        lastUsedAt: null,
        lastUsedServer: null,
        lastUsedIp: null,
        lastUsedUserAgent: null,
    })
})
