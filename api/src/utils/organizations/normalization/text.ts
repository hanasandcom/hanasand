export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

export function looksSensitive(value: string) {
    return emailPattern.test(value)
        || /^https?:\/\//i.test(value)
        || /(token|secret|password|bearer)\s*[:=]/i.test(value)
}

export function slugFor(value: string) {
    const slug = value.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)

    return slug || 'organization'
}
