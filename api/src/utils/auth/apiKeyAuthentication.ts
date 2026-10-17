import run from '#db'
import { extractApiKeyPrefix, hashApiKeySecret } from './apiKeyCredentials.ts'
import { getApiKeyScopes } from './apiKeyScopeStore.ts'
import { toApiKeySummary, type ApiKeyRow } from './apiKeyRecords.ts'

export async function validateApiKey(secret: string, query: typeof run = run) {
    const prefix = extractApiKeyPrefix(secret)
    if (!prefix) return null

    const result = await query(`
        SELECT k.id, k.owner_id, k.organization_id, k.name, k.tier, k.description, k.enabled, k.key_prefix, k.secret_hash, k.expires_at, k.last_used_at, k.created_at, k.updated_at, owner.account_type
        FROM api_keys k
        LEFT JOIN users owner ON owner.id = k.owner_id
        LEFT JOIN organizations o ON o.id = k.organization_id
        WHERE k.key_prefix = $1 AND k.enabled IS TRUE
          AND (k.expires_at IS NULL OR k.expires_at > NOW())
          AND (
              (k.organization_id IS NULL AND owner.active IS TRUE AND owner.deletion_scheduled_at IS NULL)
              OR (
                  k.organization_id IS NOT NULL AND o.status = 'active'
                  AND EXISTS (
                      SELECT 1
                      FROM organization_members owner_membership
                      JOIN users active_owner
                        ON active_owner.id = owner_membership.user_id
                       AND active_owner.active IS TRUE
                       AND active_owner.deletion_scheduled_at IS NULL
                      WHERE owner_membership.organization_id = k.organization_id
                        AND owner_membership.role = 'owner'
                        AND owner_membership.status = 'active'
                  )
              )
          )
        LIMIT 1
    `, [prefix])

    const apiKey = result.rows[0] as ApiKeyRow | undefined
    if (!apiKey || hashApiKeySecret(secret) !== apiKey.secret_hash) return null

    const scopes = await getApiKeyScopes(apiKey.id, query)
    await query(`
        UPDATE api_keys
        SET last_used_at = NOW(), updated_at = updated_at
        WHERE id = $1
    `, [apiKey.id]).catch(() => {})

    return {
        apiKey: toApiKeySummary(apiKey, scopes),
        ownerId: apiKey.owner_id,
        serviceAccount: apiKey.account_type === 'service',
        organizationId: apiKey.organization_id,
    }
}
