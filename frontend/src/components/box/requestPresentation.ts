import type { HeaderRow } from './types'

export function headerRowsFromObject(headers: Record<string, string>): HeaderRow[] {
    const rows = Object.entries(headers).map(([key, value]) => ({ key, value }))
    return rows.length ? rows : [{ key: '', value: '' }]
}

export function uniqueWarnings(warnings: string[]) {
    return Array.from(new Set(warnings.filter(Boolean)))
}

export function shortUrlLabel(value: string) {
    try {
        const url = new URL(value)
        return `${url.host}${url.pathname}${url.search}`
    } catch {
        return value
    }
}
