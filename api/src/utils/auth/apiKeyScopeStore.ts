import { randomUUID } from 'crypto'
import run from '#db'
import { normalizeLimit } from './apiKeyPolicy.ts'
import { toApiKeyScopeRule, type ApiKeyScopeRow } from './apiKeyRecords.ts'

export async function replaceApiKeyScopes(apiKeyId: string, scopes: ApiKeyScopeRule[], query: typeof run = run) {
    await query('DELETE FROM api_key_scopes WHERE api_key_id = $1', [apiKeyId])

    for (const scope of scopes) {
        await query(`
            INSERT INTO api_key_scopes (
                id, api_key_id, method, route, enabled, per_second, per_minute, per_hour, per_day, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [
            randomUUID(),
            apiKeyId,
            scope.method.toUpperCase(),
            scope.route,
            scope.enabled !== false,
            normalizeLimit(scope.limits.perSecond),
            normalizeLimit(scope.limits.perMinute),
            normalizeLimit(scope.limits.perHour),
            normalizeLimit(scope.limits.perDay),
        ])
    }
}

export async function getApiKeyScopes(apiKeyId: string, query: typeof run = run) {
    const result = await query(`
        SELECT id, api_key_id, method, route, enabled, per_second, per_minute, per_hour, per_day
        FROM api_key_scopes
        WHERE api_key_id = $1
        ORDER BY method ASC, route ASC, created_at ASC
    `, [apiKeyId])

    return (result.rows as ApiKeyScopeRow[]).map(toApiKeyScopeRule)
}
