import { DEFAULT_AGGREGATE_STALE_AFTER_SECONDS } from './productReadinessAggregateTypes'

export function firstValue(keys: readonly string[], env: Record<string, string | undefined>) {
    for (const key of keys) {
        const value = env[key]
        if (value?.trim()) return value.trim()
    }
    return undefined
}

export function staleAfterSecondsFromEnv(env: Record<string, string | undefined>) {
    const configured = Number(env.PRODUCT_READINESS_AGGREGATE_STALE_AFTER_SECONDS || env.HANASAND_PRODUCT_READINESS_STALE_AFTER_SECONDS || '')
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_AGGREGATE_STALE_AFTER_SECONDS
}

export function ageSecondsSince(value: string) {
    const checked = new Date(value).getTime()
    if (!value || Number.isNaN(checked)) return 0
    return Math.max(0, Math.floor((Date.now() - checked) / 1000))
}
