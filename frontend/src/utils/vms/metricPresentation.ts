export function latestVMMetrics(metrics: VMMetrics[] | null) {
    if (!Array.isArray(metrics) || !metrics.length) return null
    return [...metrics].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0]
}

export function formatMegabytes(raw: number | string | null) {
    const value = raw === null ? NaN : Number(raw)
    if (!Number.isFinite(value)) return '—'
    if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`
    return `${Math.round(value)} MB`
}
