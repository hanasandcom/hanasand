export function unique(values: string[]) {
    const seen = new Set<string>()
    return values.map(value => value.trim()).filter(value => {
        const key = value.toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value).toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export function parseSourceDate(value?: string) {
    if (!value) return null
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
    const year = value.match(/\b(19|20)\d{2}\b/)?.[0]
    return year ? Date.parse(`${year}-01-01`) : null
}
