export type ApiKeyRow = {
    id: string
    account_type?: string
    owner_id: string | null
    organization_id: string | null
    name: string
    tier: string
    description: string | null
    enabled: boolean
    key_prefix: string
    secret_hash: string
    expires_at: string | null
    last_used_at: string | null
    created_at: string
    updated_at: string
}

export type ApiKeyScopeRow = {
    id: string
    api_key_id: string
    method: string
    route: string
    enabled: boolean
    per_second: number | null
    per_minute: number | null
    per_hour: number | null
    per_day: number | null
}

export function toApiKeySummary(row: ApiKeyRow, scopes: ApiKeyScopeRule[]): ApiKeySummary {
    return {
        id: row.id,
        ownerId: row.owner_id,
        organizationId: row.organization_id,
        name: row.name,
        tier: row.tier,
        description: row.description,
        enabled: row.enabled,
        keyPrefix: row.key_prefix,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        scopes,
    }
}

export function toApiKeyScopeRule(row: ApiKeyScopeRow): ApiKeyScopeRule {
    return {
        id: row.id,
        enabled: row.enabled,
        method: row.method,
        route: row.route,
        limits: {
            perSecond: row.per_second,
            perMinute: row.per_minute,
            perHour: row.per_hour,
            perDay: row.per_day,
        },
    }
}
