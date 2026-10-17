import { randomUUID } from 'crypto'
import run, { withTransaction } from '#db'
import { normalizeApiKeyTier, normalizeScopeInputs } from './apiKeyPolicy.ts'
import { buildApiKeySecret, extractApiKeyPrefix, hashApiKeySecret } from './apiKeyCredentials.ts'
import { getApiKeyScopes, replaceApiKeyScopes } from './apiKeyScopeStore.ts'
import { toApiKeyScopeRule, toApiKeySummary, type ApiKeyRow, type ApiKeyScopeRow } from './apiKeyRecords.ts'

export async function listApiKeys() {
    const keysResult = await run(`
        SELECT id, owner_id, organization_id, name, tier, description, enabled, key_prefix, expires_at, last_used_at, created_at, updated_at
        FROM api_keys
        ORDER BY created_at DESC
    `)
    const scopeResult = await run(`
        SELECT id, api_key_id, method, route, enabled, per_second, per_minute, per_hour, per_day
        FROM api_key_scopes
        ORDER BY method ASC, route ASC, created_at ASC
    `)

    const scopesByKey = new Map<string, ApiKeyScopeRule[]>()
    for (const row of scopeResult.rows as ApiKeyScopeRow[]) {
        const list = scopesByKey.get(row.api_key_id) || []
        list.push(toApiKeyScopeRule(row))
        scopesByKey.set(row.api_key_id, list)
    }

    return (keysResult.rows as ApiKeyRow[]).map(row => toApiKeySummary(row, scopesByKey.get(row.id) || []))
}

export async function listOrganizationApiKeys(organizationId: string, query: typeof run = run) {
    const keysResult = await query(`
        SELECT id, owner_id, organization_id, name, tier, description, enabled, key_prefix, expires_at, last_used_at, created_at, updated_at
        FROM api_keys
        WHERE organization_id = $1
        ORDER BY created_at DESC
    `, [organizationId])
    return Promise.all((keysResult.rows as ApiKeyRow[]).map(async row =>
        toApiKeySummary(row, await getApiKeyScopes(row.id, query))
    ))
}

export async function createApiKey(input: {
    ownerId: string
    organizationId?: string | null
    name: string
    tier: ApiKeyTierPreset | string
    description?: string | null
    enabled?: boolean
    expiresAt?: string | null
    scopes?: ApiKeyScopeRule[]
}, query: typeof run = run): Promise<ApiKeyCreateResult> {
    const id = randomUUID()
    const secret = buildApiKeySecret()
    const keyPrefix = extractApiKeyPrefix(secret)
    const hash = hashApiKeySecret(secret)

    const result = await query(`
        INSERT INTO api_keys (
            id, owner_id, organization_id, name, tier, description, enabled, key_prefix, secret_hash, expires_at, last_used_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, NULL, NOW(), NOW())
        RETURNING id, owner_id, organization_id, name, tier, description, enabled, key_prefix, secret_hash, expires_at, last_used_at, created_at, updated_at
    `, [
        id,
        input.ownerId,
        input.organizationId || null,
        input.name.trim(),
        normalizeApiKeyTier(input.tier),
        input.description?.trim() || null,
        input.enabled !== false,
        keyPrefix,
        hash,
        input.expiresAt || null,
    ])

    try {
        await replaceApiKeyScopes(id, normalizeScopeInputs(input.scopes), query)
        const scopes = await getApiKeyScopes(id, query)
        return { apiKey: toApiKeySummary(result.rows[0] as ApiKeyRow, scopes), secret }
    } catch (error) {
        await query('DELETE FROM api_keys WHERE id = $1', [id]).catch(() => undefined)
        throw error
    }
}

export async function updateApiKey(id: string, input: {
    ownerId: string
    name: string
    tier: ApiKeyTierPreset | string
    description?: string | null
    enabled?: boolean
    expiresAt?: string | null
    scopes?: ApiKeyScopeRule[]
}, transaction: typeof withTransaction = withTransaction) {
    return transaction(async query => {
        const result = await query(`
            UPDATE api_keys
            SET owner_id = $2, name = $3, tier = $4, description = $5, enabled = $6,
                expires_at = $7::timestamptz, updated_at = NOW()
            WHERE id = $1
            RETURNING id, owner_id, organization_id, name, tier, description, enabled, key_prefix, secret_hash, expires_at, last_used_at, created_at, updated_at
        `, [id, input.ownerId, input.name.trim(), normalizeApiKeyTier(input.tier), input.description?.trim() || null, input.enabled !== false, input.expiresAt || null])

        if (!result.rows.length) return null

        await replaceApiKeyScopes(id, normalizeScopeInputs(input.scopes), query)
        return toApiKeySummary(result.rows[0] as ApiKeyRow, await getApiKeyScopes(id, query))
    })
}

export async function deleteApiKey(id: string) {
    const result = await run('DELETE FROM api_keys WHERE id = $1', [id])
    return (result.rowCount || 0) > 0
}

export async function revokeOrganizationApiKey(organizationId: string, id: string, query: typeof run = run) {
    const result = await query(`
        UPDATE api_keys
        SET enabled = FALSE, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2 AND enabled IS TRUE
        RETURNING id, owner_id, organization_id, name, tier, description, enabled, key_prefix, secret_hash, expires_at, last_used_at, created_at, updated_at
    `, [id, organizationId])
    const row = result.rows[0] as ApiKeyRow | undefined
    return row ? toApiKeySummary(row, await getApiKeyScopes(row.id, query)) : null
}
