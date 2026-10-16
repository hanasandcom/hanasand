export function countReadinessBlockers(detail: string) {
    const parts = detail
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
    return Math.max(1, parts.length)
}

export function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

export function latestTimestamp(values: Array<string | undefined>) {
    return values
        .filter(Boolean)
        .sort()
        .at(-1)
}

