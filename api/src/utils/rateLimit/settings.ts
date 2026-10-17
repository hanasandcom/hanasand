import run from '#db'
import { normalizeMethod, normalizeRoute, normalizeSettings, stripRateLimitMeta } from './settingsNormalization.ts'

const SETTINGS_ID = 'global'
const CACHE_TTL_MS = 5000
const routeCatalog = new Map<string, RateLimitRoute>()

type RateLimitSettingsValidationResult = {
    valid: boolean
    settings: RateLimitSettings
    error: string | null
}

let cachedSettings: RateLimitSettings | null = null
let cachedAt = 0

export async function getRateLimitSettings({ fresh = false }: { fresh?: boolean } = {}): Promise<RateLimitSettings> {
    if (!fresh && cachedSettings && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedSettings
    }

    const result = await run(`
        SELECT config_json, updated_at, updated_by
        FROM api_rate_limit_settings
        WHERE id = $1
        LIMIT 1
    `, [SETTINGS_ID])

    const row = result.rows[0] as {
        config_json?: unknown
        updated_at?: string | null
        updated_by?: string | null
    } | undefined

    const normalized = normalizeSettings(row?.config_json, {
        updatedAt: row?.updated_at || null,
        updatedBy: row?.updated_by || null,
    })

    cachedSettings = normalized
    cachedAt = Date.now()
    return normalized
}

export async function saveRateLimitSettings(input: unknown, updatedBy: string): Promise<RateLimitSettings> {
    const normalized = normalizeSettings(input, {
        updatedAt: null,
        updatedBy,
    })

    const result = await run(`
        INSERT INTO api_rate_limit_settings (id, config_json, updated_by, updated_at)
        VALUES ($1, $2::jsonb, $3, NOW())
        ON CONFLICT (id) DO UPDATE SET
            config_json = EXCLUDED.config_json,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        RETURNING updated_at, updated_by
    `, [SETTINGS_ID, JSON.stringify(stripRateLimitMeta(normalized)), updatedBy])

    const saved = {
        ...normalized,
        updatedAt: result.rows[0]?.updated_at || new Date().toISOString(),
        updatedBy: result.rows[0]?.updated_by || updatedBy,
    }

    cachedSettings = saved
    cachedAt = Date.now()
    return saved
}

export function validateRateLimitSettingsInput(
    input: unknown,
    meta: { updatedAt?: string | null, updatedBy?: string | null } = {}
): RateLimitSettingsValidationResult {
    const settings = normalizeSettings(input, {
        updatedAt: meta.updatedAt || null,
        updatedBy: meta.updatedBy || null,
    })

    const seen = new Set<string>()
    for (const override of settings.overrides) {
        if (!override.route.startsWith('/api')) {
            return {
                valid: false,
                settings,
                error: `Override route must stay inside the API namespace: ${override.method} ${override.route}.`,
            }
        }

        const key = `${override.scope}:${override.method}:${override.route}`
        if (seen.has(key)) {
            return {
                valid: false,
                settings,
                error: `Duplicate override detected for ${override.scope} ${override.method} ${override.route}.`,
            }
        }

        seen.add(key)
    }

    return {
        valid: true,
        settings,
        error: null,
    }
}

export function registerRateLimitRoute(route: RateLimitRoute) {
    const method = normalizeMethod(route.method)
    const normalizedRoute = normalizeRoute(route.route)
    if (!method || !normalizedRoute.startsWith('/api')) {
        return
    }

    routeCatalog.set(`${method} ${normalizedRoute}`, {
        method,
        route: normalizedRoute,
    })
}

export function listRateLimitRoutes(): RateLimitRoute[] {
    return Array.from(routeCatalog.values()).sort((left, right) => {
        if (left.route === right.route) {
            return left.method.localeCompare(right.method)
        }

        return left.route.localeCompare(right.route)
    })
}
