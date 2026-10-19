import { beforeEach, describe, expect, test } from 'bun:test'
import {
    createApiKey,
    listOrganizationApiKeys,
    organizationPublicApiScopes,
    revokeOrganizationApiKey,
    updateApiKey,
    validateApiKey,
} from '../src/utils/auth/apiKeys.ts'

type Row = Record<string, any>

let organizationStatus = 'active'
let organizationHasActiveOwner = true
let failScopeInsert = false
let apiKeys: Row[] = []
let scopes: Row[] = []

beforeEach(() => {
    organizationStatus = 'active'
    organizationHasActiveOwner = true
    failScopeInsert = false
    apiKeys = []
    scopes = []
})

describe('organization API key onboarding', () => {
    test('creates multiple fixed-scope organization keys and enforces their independent lifecycles', async () => {
        const created = await createApiKey({
            ownerId: 'customer-user',
            organizationId: 'org-a',
            name: 'Production integration',
            tier: 'starter',
            scopes: organizationPublicApiScopes(),
        }, fakeRun as any)
        const second = await createApiKey({
            ownerId: 'customer-user',
            organizationId: 'org-a',
            name: 'Development integration',
            tier: 'starter',
            scopes: organizationPublicApiScopes(),
        }, fakeRun as any)
        expect(created.secret).toMatch(/^hsk_[a-f0-9]{12}_[a-f0-9]{48}$/)
        expect(created.apiKey).toMatchObject({ organizationId: 'org-a', name: 'Production integration', tier: 'starter', enabled: true })
        expect(second.apiKey).toMatchObject({ organizationId: 'org-a', name: 'Development integration', tier: 'starter', enabled: true })
        expect(created.apiKey.scopes).toHaveLength(1)
        expect(created.apiKey.scopes.some(scope => scope.route.startsWith('/api/v1/'))).toBe(false)
        expect(JSON.stringify(created.apiKey)).not.toContain(created.secret)
        const wrongSecret = `${created.secret.slice(0, -1)}${created.secret.endsWith('0') ? '1' : '0'}`
        expect(await validateApiKey(wrongSecret, fakeRun as any)).toBeNull()

        expect((await validateApiKey(created.secret, fakeRun as any))?.organizationId).toBe('org-a')
        expect((await validateApiKey(second.secret, fakeRun as any))?.organizationId).toBe('org-a')
        organizationStatus = 'archived'
        expect(await validateApiKey(created.secret, fakeRun as any)).toBeNull()
        expect(await validateApiKey(second.secret, fakeRun as any)).toBeNull()
        organizationStatus = 'active'
        expect((await validateApiKey(created.secret, fakeRun as any))?.organizationId).toBe('org-a')

        organizationHasActiveOwner = false
        expect(await validateApiKey(created.secret, fakeRun as any)).toBeNull()
        organizationHasActiveOwner = true
        apiKeys[0].owner_id = null
        const afterCreatorRemoval = await validateApiKey(created.secret, fakeRun as any)
        expect(afterCreatorRemoval?.ownerId).toBeNull()
        expect(afterCreatorRemoval?.organizationId).toBe('org-a')

        const listed = await listOrganizationApiKeys('org-a', fakeRun as any)
        expect(listed).toHaveLength(2)
        expect(listed.map(key => key.name).sort()).toEqual(['Development integration', 'Production integration'])
        expect(JSON.stringify(listed)).not.toContain(created.secret)
        expect(await revokeOrganizationApiKey('org-b', created.apiKey.id, fakeRun as any)).toBeNull()
        expect((await revokeOrganizationApiKey('org-a', created.apiKey.id, fakeRun as any))?.enabled).toBe(false)
        expect(await validateApiKey(created.secret, fakeRun as any)).toBeNull()
        expect((await validateApiKey(second.secret, fakeRun as any))?.organizationId).toBe('org-a')
        expect((await revokeOrganizationApiKey('org-a', second.apiKey.id, fakeRun as any))?.enabled).toBe(false)
        expect(await validateApiKey(second.secret, fakeRun as any)).toBeNull()
    })

    test('rolls back key metadata when replacing scopes fails', async () => {
        const created = await createApiKey({
            ownerId: 'customer-user',
            organizationId: 'org-a',
            name: 'Production integration',
            tier: 'starter',
            scopes: organizationPublicApiScopes(),
        }, fakeRun as any)
        const originalScopes = scopes.map(scope => ({ ...scope }))

        failScopeInsert = true
        await expect(updateApiKey(created.apiKey.id, {
            ownerId: 'replacement-user',
            name: 'Changed integration',
            tier: 'growth',
            description: 'Updated description',
            expiresAt: '2027-01-01T00:00:00.000Z',
            scopes: organizationPublicApiScopes().slice(0, 1),
        }, fakeTransaction as any)).rejects.toThrow('Scope insert failed')

        expect(apiKeys[0]).toMatchObject({
            owner_id: 'customer-user',
            name: 'Production integration',
            tier: 'starter',
            description: null,
        })
        expect(scopes).toEqual(originalScopes)
    })
})

async function fakeTransaction<T>(work: (query: any) => Promise<T>) {
    const originalApiKeys = apiKeys.map(row => ({ ...row }))
    const originalScopes = scopes.map(row => ({ ...row }))
    try {
        return await work(fakeRun as any)
    } catch (error) {
        apiKeys = originalApiKeys
        scopes = originalScopes
        throw error
    }
}

async function fakeRun(sql: string, params: unknown[] = []) {
    const query = sql.replace(/\s+/g, ' ').trim()
    if (query.startsWith('INSERT INTO api_keys')) {
        const now = new Date().toISOString()
        const row = {
            id: params[0], owner_id: params[1], organization_id: params[2], name: params[3], tier: params[4],
            description: params[5], enabled: params[6], key_prefix: params[7], secret_hash: params[8],
            expires_at: params[9], last_used_at: null, created_at: now, updated_at: now,
        }
        apiKeys.push(row)
        return { rows: [row], rowCount: 1 }
    }
    if (query.startsWith('DELETE FROM api_keys WHERE id = $1')) {
        const before = apiKeys.length
        apiKeys = apiKeys.filter(row => row.id !== params[0])
        return { rows: [], rowCount: before - apiKeys.length }
    }
    if (query.startsWith('DELETE FROM api_key_scopes')) {
        scopes = scopes.filter(row => row.api_key_id !== params[0])
        return { rows: [], rowCount: 0 }
    }
    if (query.startsWith('INSERT INTO api_key_scopes')) {
        if (failScopeInsert) throw new Error('Scope insert failed')
        scopes.push({
            id: params[0], api_key_id: params[1], method: params[2], route: params[3], enabled: params[4],
            per_second: params[5], per_minute: params[6], per_hour: params[7], per_day: params[8],
        })
        return { rows: [], rowCount: 1 }
    }
    if (query.startsWith('UPDATE api_keys') && query.includes('SET owner_id = $2')) {
        const row = apiKeys.find(item => item.id === params[0])
        if (!row) return { rows: [], rowCount: 0 }
        Object.assign(row, {
            owner_id: params[1], name: params[2], tier: params[3], description: params[4],
            enabled: params[5], expires_at: params[6], updated_at: new Date().toISOString(),
        })
        return { rows: [row], rowCount: 1 }
    }
    if (query.includes('FROM api_key_scopes') && query.includes('WHERE api_key_id = $1')) {
        return { rows: scopes.filter(row => row.api_key_id === params[0]) }
    }
    if (query.includes('FROM api_keys') && query.includes('WHERE organization_id = $1') && query.includes('ORDER BY created_at DESC')) {
        return { rows: apiKeys.filter(row => row.organization_id === params[0]) }
    }
    if (query.startsWith('UPDATE api_keys') && query.includes('organization_id = $2')) {
        const row = apiKeys.find(item => item.id === params[0] && item.organization_id === params[1] && item.enabled)
        if (!row) return { rows: [], rowCount: 0 }
        row.enabled = false
        row.updated_at = new Date().toISOString()
        return { rows: [row], rowCount: 1 }
    }
    if (query.includes('FROM api_keys k') && query.includes('WHERE k.key_prefix = $1')) {
        return {
            rows: apiKeys.filter(row =>
                row.key_prefix === params[0]
                && row.enabled
                && (row.organization_id
                    ? organizationStatus === 'active' && organizationHasActiveOwner
                    : Boolean(row.owner_id))
            ).slice(0, 1),
        }
    }
    if (query.startsWith('UPDATE api_keys') && query.includes('last_used_at = NOW()')) return { rows: [], rowCount: 1 }
    throw new Error(`Unhandled SQL in organization API key test: ${query}`)
}
