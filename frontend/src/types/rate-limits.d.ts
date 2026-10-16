type RateLimitScope = 'anonymous' | 'authenticated' | 'internal'

type RateLimitRule = {
    windowMs: number
    maxRequests: number
}

type RateLimitOverride = {
    id: string
    enabled: boolean
    method: string
    route: string
    scope: RateLimitScope
    windowMs: number
    maxRequests: number
}

type RateLimitSettings = {
    enabled: boolean
    defaults: Record<RateLimitScope, RateLimitRule>
    overrides: RateLimitOverride[]
    updatedAt: string | null
    updatedBy: string | null
}

type RateLimitRoute = {
    method: string
    route: string
}

type ApiKeyPeriodLimits = {
    perSecond: number | null
    perMinute: number | null
    perHour: number | null
    perDay: number | null
}

type ApiKeyTierPreset = 'starter' | 'growth' | 'business' | 'internal' | 'custom'

type ApiKeyTierDefinition = {
    id: ApiKeyTierPreset
    label: string
    description: string
    defaultLimits: ApiKeyPeriodLimits
}

type ApiKeyScopeRule = {
    id: string
    enabled: boolean
    method: string
    route: string
    limits: ApiKeyPeriodLimits
}

type ApiKeySummary = {
    id: string
    ownerId: string | null
    name: string
    tier: ApiKeyTierPreset | string
    description: string | null
    enabled: boolean
    keyPrefix: string
    createdAt: string
    updatedAt: string
    expiresAt: string | null
    lastUsedAt: string | null
    scopes: ApiKeyScopeRule[]
}

type ApiKeyCreateResult = {
    apiKey: ApiKeySummary
    secret: string
}
