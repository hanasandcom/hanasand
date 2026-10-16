export function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

export function firstClean(...values: unknown[]) {
    for (const value of values) {
        const candidate = clean(value)
        if (candidate) return candidate
    }
    return ''
}

export function recordOrEmpty(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function redactAuditMetadata(metadata: Record<string, unknown>) {
    const redacted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(metadata)) {
        if (/endpoint|secret|token|password|credential|url/i.test(key) && key !== 'endpointHint') {
            redacted[key] = '[redacted]'
        } else if (typeof value === 'string') {
            redacted[key] = value.slice(0, 1000)
        } else {
            redacted[key] = value
        }
    }
    return redacted
}

export function cleanList(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.map(clean).filter(Boolean)
}
