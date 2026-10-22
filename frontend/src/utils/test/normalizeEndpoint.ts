const explicitSchemePattern = /^[a-z][a-z\d+.-]*:\/\//i

export function normalizeEndpoint(value: string) {
    const trimmed = value.trim()
    if (!trimmed || explicitSchemePattern.test(trimmed)) return trimmed
    return `https://${trimmed}`
}

export function isValidEndpoint(value: string) {
    try {
        const url = new URL(value)
        return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
    } catch {
        return false
    }
}
