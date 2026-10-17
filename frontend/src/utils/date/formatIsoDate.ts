export function formatIsoDate(value: string, emptyFallback = '') {
    if (!value) return emptyFallback
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10)
}
