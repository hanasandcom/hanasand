export type JsonRecord = Record<string, unknown>

export function arrayOfRecords(value: unknown): JsonRecord[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

export function arrayOfStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.map(item => stringValue(item)).filter((item): item is string => Boolean(item))
}

export function bearerToken(value: string | null) {
    if (!value?.startsWith('Bearer ')) return ''
    return value.slice('Bearer '.length).trim()
}

export function numberValue(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

export function objectValue(value: unknown): JsonRecord | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

export function parseJsonObject(text: string): JsonRecord {
    try {
        const parsed = text ? JSON.parse(text) : {}
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return { raw: text }
    }
}

export function stringValue(value: unknown) {
    const text = String(value ?? '').trim()
    return text || undefined
}
