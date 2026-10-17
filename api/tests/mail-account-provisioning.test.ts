import { expect, mock, test } from 'bun:test'

const principalPatches: Array<{ name: string, patches: unknown[] }> = []
const accountWrites: Array<{ userId: string, username: string, address: string, encryptedPassword: string, principalId: number | null }> = []
const account = {
    user_id: 'user-1', mail_username: 'user-one', mail_address: 'user-one@example.test',
    mail_password_encrypted: 'encrypted:stored-secret', principal_id: 7,
}

mock.module('#db', () => ({ default: async (sql: string) => sql.includes('FROM mail_accounts') ? { rows: [account] } : { rows: [] } }))
mock.module('#utils/db/identityDataWrites.ts', () => ({ upsertMailAccount: async (input: typeof accountWrites[number]) => { accountWrites.push(input) } }))
mock.module('../src/utils/mail/shared.ts', () => ({ MailAccessDenied: class extends Error {} }))
mock.module('../src/utils/mail/config.ts', () => ({ mailConfig: { host: 'mail.example.test', domain: 'example.test' } }))
mock.module('../src/utils/mail/crypto.ts', () => ({
    encryptMailSecret: (secret: string) => `encrypted:${secret}`,
    tryDecryptMailSecret: (secret: string) => secret.replace(/^encrypted:/, ''),
    generateMailSecret: () => 'rotated-secret',
}))
mock.module('../src/utils/mail/helpers.ts', () => ({
    mailboxLocalPartForUser: () => 'user-one',
    addressForUser: () => 'user-one@example.test',
    addressesForUser: () => ['user-one@example.test'],
}))
mock.module('../src/utils/mail/stalwartAdmin.ts', () => ({
    ensureSetting: async () => undefined,
    createPrincipal: async () => 7,
    findPrincipalByName: async (name: string, type: string) => type === 'domain'
        ? { name, catchAllAddress: 'support@example.test' }
        : { id: 7, name: 'user-one', secrets: ['principal-secret'], emails: ['user-one@example.test'] },
    patchPrincipal: async (name: string, patches: unknown[]) => { principalPatches.push({ name, patches }) },
    setDomainCatchAllAddress: async () => undefined,
}))

const { ensureMailAccountForUser, rotateMailPasswordForUser } = await import('../src/utils/mail/accountProvisioning.ts')

test('provisioning reuses the stored secret and explicit rotation updates principal and account', async () => {
    const existing = await ensureMailAccountForUser('user-1', 'User One')
    expect(existing.password).toBe('stored-secret')
    expect(accountWrites.at(-1)?.encryptedPassword).toBe('encrypted:stored-secret')
    expect(principalPatches.at(-1)?.patches).toContainEqual({ action: 'set', field: 'secrets', value: ['stored-secret'] })

    const rotated = await rotateMailPasswordForUser('user-1', 'User One')
    expect(rotated.password).toBe('rotated-secret')
    expect(accountWrites.at(-1)?.encryptedPassword).toBe('encrypted:rotated-secret')
    expect(principalPatches.at(-1)?.patches).toContainEqual({ action: 'set', field: 'secrets', value: ['rotated-secret'] })
})
