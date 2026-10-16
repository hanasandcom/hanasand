export function sourceConfidenceLabel(values: number[]) {
    if (!values.length) return 'Not scored'
    const sorted = values.slice().sort((a, b) => a - b)
    const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    return sourceBasisLabel(average)
}

export function sourceBasisLabel(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Not scored'
    if (value >= 0.8) return 'Strong'
    if (value >= 0.6) return 'Moderate'
    if (value >= 0.4) return 'Limited'
    return 'Needs review'
}

export function uniqueNumbers(values: number[]) {
    return Array.from(new Set(values.map(value => Math.max(0, Math.min(1, value)))))
}
