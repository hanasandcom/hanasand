import { beforeEach, expect, mock, test } from 'bun:test'

const cleanupQueries: string[] = []
const hostUpdates: Array<{ keys: string[], revoked: string[] }> = []
let userKeys = [{ id: 8, public_key: 'target-key' }]
let activeKeys = ['shared-key']
let hostFailure = false

mock.module('#db', () => ({
    default: async () => ({ rows: [] }),
    identityQueryOnce: async (sql: string) => {
        cleanupQueries.push(sql.replace(/\s+/g, ' ').trim())
        if (sql.includes('assignment.user_id = $1')) return { rows: userKeys }
        if (sql.includes('active_user.active')) return { rows: activeKeys.map(public_key => ({ public_key })) }
        return { rows: [] }
    },
    withIdentityAdvisoryLock: async (_key: string, work: () => unknown) => work(),
    withIdentityTransaction: async (work: (query: (sql: string, params?: unknown[]) => unknown) => unknown) => work(async sql => {
        cleanupQueries.push(sql.replace(/\s+/g, ' ').trim())
        return { rows: [] }
    }),
}))
mock.module('#utils/profileSshKeyCache.ts', () => ({ invalidateProfileSshKeysResponseCache: () => {} }))
mock.module('#utils/sshKeyUsage.ts', () => ({ invalidateProfileSshKeyUsageIndex: () => {} }))
mock.module('#utils/hostSsh.ts', () => ({
    normalizeHostPublicKey: (value: string) => ({ fingerprint: value, publicKey: value }),
    applyManagedHostSshKeys: async (keys: string[], revoked: string[]) => {
        hostUpdates.push({ keys, revoked })
        if (hostFailure) throw new Error('host unavailable')
    },
}))

const { purgeUserSshKeys } = await import('../src/utils/auth/purgeUserSshKeys.ts')

beforeEach(() => {
    cleanupQueries.length = 0
    hostUpdates.length = 0
    userKeys = [{ id: 8, public_key: 'target-key' }]
    activeKeys = ['shared-key']
    hostFailure = false
})

test('revokes only personal keys not still assigned to active users', async () => {
    const deleted = await purgeUserSshKeys('deleted-user')

    expect(deleted).toBe(1)
    expect(hostUpdates).toEqual([{ keys: ['shared-key'], revoked: ['target-key'] }])
    expect(cleanupQueries.some(sql => sql.includes('DELETE FROM user_certificates'))).toBe(true)
    expect(cleanupQueries.some(sql => sql.includes('DELETE FROM certificates'))).toBe(true)
})

test('leaves identity key rows in place when managed-host revocation fails', async () => {
    hostFailure = true

    await expect(purgeUserSshKeys('deleted-user')).rejects.toThrow('host unavailable')

    expect(hostUpdates).toHaveLength(1)
    expect(cleanupQueries.some(sql => sql.includes('DELETE FROM user_certificates'))).toBe(false)
    expect(cleanupQueries.some(sql => sql.includes('DELETE FROM certificates'))).toBe(false)
})

test('does not revoke a key still shared by an active account', async () => {
    activeKeys = ['target-key']

    await purgeUserSshKeys('deleted-user')

    expect(hostUpdates).toEqual([{ keys: ['target-key'], revoked: [] }])
})
