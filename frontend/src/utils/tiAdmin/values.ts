export type ApiPayload = Record<string, unknown>
export type ResourceResult = { resource: string, ok: boolean, records: ApiPayload[], total: number, nextCursor?: string, previousCursor?: string, payload: ApiPayload }

export function objectValue(value: unknown): ApiPayload {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as ApiPayload : {}
}

export function recordArray(value: unknown): ApiPayload[] {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as ApiPayload[] : []
}

export function listValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

export function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim().slice(0, 500) : ''
}

export function textValue(...values: unknown[]) {
    return values.map(stringValue).find(Boolean) || ''
}

export function numberValue(...values: unknown[]) {
    for (const value of values) {
        const number = Number(value)
        if (Number.isFinite(number) && number >= 0) return number
    }
    return 0
}

export function optionalIso(...values: unknown[]) {
    for (const value of values) {
        const date = new Date(stringValue(value))
        if (Number.isFinite(date.getTime())) return date.toISOString()
    }
    return undefined
}

export function isoValue(...values: unknown[]) {
    return optionalIso(...values) || ''
}

export function hostname(value: string) {
    try { return new URL(value).hostname }
    catch { return '' }
}

export function unique(values: string[]) {
    return [...new Set(values)]
}

export function titleCase(value: string) {
    return value.replace(/\b\w/g, letter => letter.toUpperCase())
}
