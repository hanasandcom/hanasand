import { beforeEach, expect, mock, test } from 'bun:test'

let userId = 'profile-test-user'
let certificateRows: Array<{ id: number, name: string, public_key: string, added_at: string }> = []
let usageRows: Array<{ fingerprint: string, added_at: string, last_used_at: string }> = []
let usageQuery = ''
let usageParams: unknown[] = []

const fingerprint = (name: string) => `SHA256:${name.padEnd(43, 'A')}`
const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM certificates c')) return { rows: certificateRows }
    if (sql.includes('FROM unnest($1::text[], $2::timestamptz[])')) {
        usageQuery = sql
        usageParams = params
        return { rows: usageRows }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
}

mock.module('#db', () => ({
    default: query,
    withReadDatabase: async (work: (run: typeof query) => unknown) => work(query),
    withDatabaseAdvisoryLock: async (_key: string, work: () => unknown) => work(),
    withTransaction: async (work: (run: typeof query) => unknown) => work(query),
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
    usageRows = []
    usageQuery = ''
    usageParams = []
})

async function getKeys() {
    const reply = {
        body: undefined as unknown,
        header() { return this },
        status() { return this },
        send(body: unknown) { this.body = body; return body },
    }
    await getProfileSshKeys({} as never, reply as never)
    return reply.body as { keys: Array<{ addedAt: string, fingerprint: string, lastUsedAt: string | null }> }
}

test('profile SSH key usage ignores records before the key was added', async () => {
    const addedAt = '2026-10-01T14:09:31.000Z'
    certificateRows = [{ id: 7, name: 'historical', public_key: 'ssh-ed25519 encoded historical', added_at: addedAt }]
    usageRows = [{ fingerprint: fingerprint('historical'), added_at: addedAt, last_used_at: '2026-09-30T22:14:51.000Z' }]

    const result = await getKeys()

    expect(result.keys[0]?.lastUsedAt).toBeNull()
    expect(usageQuery).toContain('e.event_timestamp >= requested.added_at')
    expect(usageParams.slice(0, 2)).toEqual([[fingerprint('historical')], [addedAt]])
})

test('profile SSH key usage accepts OVH collector host labels and newer events', async () => {
    const addedAt = '2026-10-01T14:09:31.000Z'
    const lastUsedAt = '2026-10-06T03:01:25.000Z'
    certificateRows = [{ id: 8, name: 'ovh-key', public_key: 'ssh-ed25519 encoded ovh-key', added_at: addedAt }]
    usageRows = [{ fingerprint: fingerprint('ovh-key'), added_at: addedAt, last_used_at: lastUsedAt }]

    const result = await getKeys()

    expect(result.keys[0]?.lastUsedAt).toBe(lastUsedAt)
    expect(usageQuery).toContain('e.normalized->>\'host\' = \'ovh\'')
    expect(usageParams.slice(0, 2)).toEqual([[fingerprint('ovh-key')], [addedAt]])
})
