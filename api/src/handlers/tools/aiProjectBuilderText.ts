export function containsAny(value: string, phrases: string[]) {
    return phrases.some(phrase => value.includes(phrase))
}

export function toolTag(path: string, content: string) {
    return `<hanasand-tool>${JSON.stringify({ action: 'upsert_share', path, content })}</hanasand-tool>`
}

export function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'hanasand-project'
}

export function escapeTs(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}
