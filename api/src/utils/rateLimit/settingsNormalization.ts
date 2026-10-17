const DEFAULT_SETTINGS: Omit<RateLimitSettings, 'updatedAt' | 'updatedBy'> = {
    enabled: true,
    defaults: {
        anonymous: { windowMs: 60_000, maxRequests: 90 },
        authenticated: { windowMs: 60_000, maxRequests: 1_800 },
        internal: { windowMs: 60_000, maxRequests: 6_000 },
    },
    overrides: [],
}

export function normalizeSettings(
    input: unknown,
    meta: { updatedAt: string | null, updatedBy: string | null },
): RateLimitSettings {
    const raw = input && typeof input === 'object' ? input as Partial<RateLimitSettings> : {}
    const defaults = raw.defaults && typeof raw.defaults === 'object'
        ? raw.defaults as Partial<Record<RateLimitScope, RateLimitRule>>
        : {}

    return {
        enabled: raw.enabled !== false,
        defaults: {
            anonymous: normalizeRule(defaults.anonymous, DEFAULT_SETTINGS.defaults.anonymous),
            authenticated: normalizeRule(defaults.authenticated, DEFAULT_SETTINGS.defaults.authenticated),
            internal: normalizeRule(defaults.internal, DEFAULT_SETTINGS.defaults.internal),
        },
        overrides: Array.isArray(raw.overrides)
            ? raw.overrides.map((override, index) => normalizeOverride(override, index)).filter(Boolean) as RateLimitOverride[]
            : [],
        updatedAt: meta.updatedAt,
        updatedBy: meta.updatedBy,
    }
}

export function stripRateLimitMeta(settings: RateLimitSettings) {
    return {
        enabled: settings.enabled,
        defaults: settings.defaults,
        overrides: settings.overrides,
    }
}

function normalizeOverride(input: unknown, index: number): RateLimitOverride | null {
    if (!input || typeof input !== 'object') {
        return null
    }

    const raw = input as Partial<RateLimitOverride>
    const method = normalizeMethod(raw.method)
    const route = normalizeRoute(raw.route)
    const scope = normalizeScope(raw.scope)

    if (!method || !route) {
        return null
    }

    return {
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `override_${index}_${method}_${route}_${scope}`,
        enabled: raw.enabled !== false,
        method,
        route,
        scope,
        windowMs: clampWindowMs(raw.windowMs),
        maxRequests: clampMaxRequests(raw.maxRequests),
    }
}

function normalizeRule(input: unknown, fallback: RateLimitRule): RateLimitRule {
    if (!input || typeof input !== 'object') {
        return fallback
    }

    const raw = input as Partial<RateLimitRule>
    return {
        windowMs: clampWindowMs(raw.windowMs ?? fallback.windowMs),
        maxRequests: clampMaxRequests(raw.maxRequests ?? fallback.maxRequests),
    }
}

function normalizeScope(value: unknown): RateLimitScope {
    return value === 'authenticated' || value === 'internal' ? value : 'anonymous'
}

export function normalizeMethod(value: unknown) {
    if (typeof value !== 'string') {
        return ''
    }

    const method = value.trim().toUpperCase()
    return method
}

export function normalizeRoute(value: unknown) {
    if (typeof value !== 'string') {
        return ''
    }

    const route = value.trim()
    if (!route) {
        return ''
    }

    return route.startsWith('/') ? route : `/${route}`
}

function clampWindowMs(value: unknown) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return 60_000
    }

    return Math.min(Math.max(Math.round(number), 1_000), 86_400_000)
}

function clampMaxRequests(value: unknown) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return 60
    }

    return Math.min(Math.max(Math.round(number), 1), 1_000_000)
}
