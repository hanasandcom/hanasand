import type { ToolResponse } from './types'

export function formatRawResponseBody(response: ToolResponse) {
    const warnings = response.warnings?.length
        ? `Warnings:\n${response.warnings.join('\n')}\n\n`
        : ''

    if (response.error) {
        return `${warnings}${response.error}`
    }

    return `${warnings}${response.body || 'No response body.'}`
}

export function formatPrettyResponseBody(response: ToolResponse) {
    const raw = formatRawResponseBody(response)
    if (response.error || !response.body) {
        return raw
    }

    try {
        const parsed = JSON.parse(response.body)
        const warnings = response.warnings?.length
            ? `Warnings:\n${response.warnings.join('\n')}\n\n`
            : ''
        return `${warnings}${JSON.stringify(parsed, null, 2)}`
    } catch {
        return raw
    }
}

export function formatJsonTree(response: ToolResponse, filter = '') {
    if (response.error) {
        return response.error
    }

    if (!response.body) {
        return 'No response body.'
    }

    try {
        const parsed = JSON.parse(response.body) as unknown
        const rows = flattenJson(parsed)
        const formattedRows = rows.length ? rows : ['$ = ' + formatJsonTreeValue(parsed)]
        const normalizedFilter = filter.trim().toLowerCase()
        const visibleRows = normalizedFilter
            ? formattedRows.filter((row) => row.toLowerCase().includes(normalizedFilter))
            : formattedRows
        return visibleRows.length ? visibleRows.join('\n') : 'No JSON paths match this filter.'
    } catch {
        return 'Tree view is available for JSON responses.'
    }
}

export function flattenJson(value: unknown, path = '$'): string[] {
    if (Array.isArray(value)) {
        if (!value.length) {
            return [`${path} = []`]
        }

        return value.flatMap((item, index) => flattenJson(item, `${path}[${index}]`))
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
        if (!entries.length) {
            return [`${path} = {}`]
        }

        return entries.flatMap(([key, item]) => flattenJson(item, `${path}.${key}`))
    }

    return [`${path} = ${formatJsonTreeValue(value)}`]
}

export function formatJsonTreeValue(value: unknown) {
    return typeof value === 'string' ? JSON.stringify(value) : String(value)
}

export function formatFilteredHeaders(headers: Record<string, string>, filter = '') {
    const rows = Object.entries(headers)
    if (!rows.length) {
        return 'No headers.'
    }

    const normalizedFilter = filter.trim().toLowerCase()
    const visibleRows = normalizedFilter
        ? rows.filter(([key, value]) => `${key}: ${value}`.toLowerCase().includes(normalizedFilter))
        : rows

    return visibleRows.length
        ? visibleRows.map(([key, value]) => `${key}: ${value}`).join('\n')
        : 'No response headers match this filter.'
}
