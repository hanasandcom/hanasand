export const API_KEY_TIER_ORDER: ApiKeyTierPreset[] = ['starter', 'growth', 'business', 'internal', 'custom']

const API_KEY_TIER_PRESETS: Record<ApiKeyTierPreset, ApiKeyTierDefinition> = {
    starter: { id: 'starter', label: 'Starter', description: 'Low-volume external integrations.', defaultLimits: { perSecond: 2, perMinute: 60, perHour: 1_000, perDay: 10_000 } },
    growth: { id: 'growth', label: 'Growth', description: 'Steady third-party traffic with moderate burst room.', defaultLimits: { perSecond: 8, perMinute: 240, perHour: 6_000, perDay: 60_000 } },
    business: { id: 'business', label: 'Business', description: 'Higher-throughput production integrations.', defaultLimits: { perSecond: 20, perMinute: 600, perHour: 24_000, perDay: 250_000 } },
    internal: { id: 'internal', label: 'Internal', description: 'Trusted internal automations and operations.', defaultLimits: { perSecond: 60, perMinute: 3_000, perHour: 120_000, perDay: 1_000_000 } },
    custom: { id: 'custom', label: 'Custom', description: 'Manually tuned per-endpoint limits.', defaultLimits: { perSecond: 5, perMinute: 60, perHour: 1_000, perDay: 10_000 } },
}

export function listApiKeyTierPresets() {
    return API_KEY_TIER_ORDER.map((id) => API_KEY_TIER_PRESETS[id])
}

export function normalizeApiKeyTier(value: unknown): ApiKeyTierPreset {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return API_KEY_TIER_ORDER.find((tier) => tier === normalized) || 'custom'
}

export function organizationPublicApiScopes(): ApiKeyScopeRule[] {
    const routes = [
        ['POST', '/mill'],
        ['POST', '/api/v1/ti/search'],
        ['POST', '/api/v1/ti/search/batch'],
        ...['actors', 'aliases', 'incidents', 'findings', 'evidence', 'sources', 'validations', 'alerts', 'evaluation', 'timeliness']
            .map(route => ['GET', `/api/v1/${route}`]),
    ]
    return routes.map(([method, route], index) => ({
        id: `organization-public-api-${index}`,
        enabled: true,
        method,
        route,
        limits: route.endsWith('/batch')
            ? { perSecond: 1, perMinute: 12, perHour: 120, perDay: 1_000 }
            : { ...API_KEY_TIER_PRESETS.starter.defaultLimits },
    }))
}

export function validateApiKeyScopes(scopes: unknown) {
    const normalizedScopes = normalizeScopeInputs(scopes)
    if (!normalizedScopes.length) {
        return { valid: false, scopes: [] as ApiKeyScopeRule[], error: 'At least one API key scope is required.' }
    }

    const seen = new Set<string>()
    for (const scope of normalizedScopes) {
        const key = `${scope.method}:${scope.route}`
        if (seen.has(key)) {
            return {
                valid: false,
                scopes: normalizedScopes,
                error: `Duplicate API key scope for ${scope.method} ${scope.route}.`,
            }
        }
        seen.add(key)
    }

    return { valid: true, scopes: normalizedScopes, error: null }
}

export function validateApiKeyFields(input: {
    ownerId?: unknown
    name?: unknown
    tier?: unknown
    description?: unknown
    expiresAt?: unknown
}) {
    const missing = [
        [input.ownerId, 'ownerId'],
        [input.name, 'name'],
        [input.tier, 'tier'],
        [input.expiresAt, 'expiresAt'],
        [input.description, 'description'],
    ].find(([value]) => typeof value !== 'string' || !value.trim())
    if (missing) return { valid: false, error: `Missing required API key field: ${missing[1]}.` }

    if (Number.isNaN(Date.parse(String(input.expiresAt)))) {
        return { valid: false, error: 'expiresAt must be a valid date.' }
    }

    return { valid: true, error: null }
}

export function normalizeScopeInputs(scopes: unknown): ApiKeyScopeRule[] {
    if (!Array.isArray(scopes)) return []
    return scopes
        .map((scope, index) => normalizeScopeInput(scope, index))
        .filter((scope): scope is ApiKeyScopeRule => Boolean(scope))
}

function normalizeScopeInput(scope: unknown, index: number): ApiKeyScopeRule | null {
    if (!scope || typeof scope !== 'object') return null

    const raw = scope as Partial<ApiKeyScopeRule>
    const method = typeof raw.method === 'string' ? raw.method.trim().toUpperCase() : ''
    const route = typeof raw.route === 'string' ? raw.route.trim() : ''
    if (!method || !route) return null

    const limits = raw.limits && typeof raw.limits === 'object' ? raw.limits as Partial<ApiKeyPeriodLimits> : {}
    return {
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `scope_${index}_${method}_${route}`,
        enabled: raw.enabled !== false,
        method,
        route: route.startsWith('/') ? route : `/${route}`,
        limits: {
            perSecond: normalizeLimit(limits.perSecond),
            perMinute: normalizeLimit(limits.perMinute),
            perHour: normalizeLimit(limits.perHour),
            perDay: normalizeLimit(limits.perDay),
        },
    }
}

export function normalizeLimit(value: number | null | undefined) {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return null
    return Math.round(number)
}

export function matchApiKeyScope(scopes: ApiKeyScopeRule[], method: string, route: string) {
    return scopes.find((scope) =>
        scope.enabled
        && scope.method === method.toUpperCase()
        && canonicalScopeRoute(scope.route) === canonicalScopeRoute(route)
    ) || null
}

function canonicalScopeRoute(route: string) {
    return route === '/api/v1/claims' ? '/api/v1/findings' : route
}
