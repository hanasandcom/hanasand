import { sanitizeOrganizationDisplayCopy } from './textSafety'

export function compactReference(value: string | undefined | null, label = 'ref') {
    if (!value) return undefined
    const clean = sanitizeOrganizationDisplayCopy(value) || value
    const labelText = label.trim() || 'ref'
    const prefix = labelText.toLowerCase()
    const normalized = clean.replace(new RegExp(`^(?:dwm[_:-]+)?${escapeRegExp(prefix)}[_:-]+`, 'i'), '')
    const compact = shortTraceId(normalized || clean).replace(/[_:]+/g, ' ').replace(/\s+/g, ' ').trim()
    return `${labelText} ${compact || shortTraceId(normalized || clean)}`
}

export function shortTraceId(value: string) {
    const cleaned = value.trim()
    if (cleaned.length <= 24) return cleaned
    return cleaned.slice(-12).replace(/^[:_-]+/, '') || cleaned.slice(-12)
}

export function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
