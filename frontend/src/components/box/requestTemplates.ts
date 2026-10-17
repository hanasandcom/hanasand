import type { HeaderRow, VariableRow } from './types'

export function normalizeHeaderRows(value: unknown, mapValue: (value: string) => string = value => value): HeaderRow[] {
    if (!Array.isArray(value)) {
        return [{ key: '', value: '' }]
    }

    const rows = value.flatMap((row): HeaderRow[] => {
        if (!row || typeof row !== 'object') {
            return []
        }

        const item = row as Partial<HeaderRow>
        if (typeof item.key !== 'string') {
            return []
        }

        return [{
            key: item.key,
            value: typeof item.value === 'string' ? mapValue(item.value) : '',
        }]
    })

    return rows.length ? rows : [{ key: '', value: '' }]
}

export function normalizeVariableRows(value: unknown): VariableRow[] {
    if (!Array.isArray(value)) {
        return [{ key: '', value: '' }]
    }

    const rows = value.flatMap((row): VariableRow[] => {
        if (!row || typeof row !== 'object') {
            return []
        }

        const item = row as Partial<VariableRow>
        return [{
            key: typeof item.key === 'string' ? item.key : '',
            value: typeof item.value === 'string' ? item.value : '',
        }]
    })

    return rows.length ? rows : [{ key: '', value: '' }]
}

export function buildRequestHeaders(rows: HeaderRow[], variables: Record<string, string>) {
    return Object.fromEntries(
        rows
            .map((row) => ({ key: resolveTemplate(row.key, variables).trim(), value: resolveTemplate(row.value, variables).trim() }))
            .filter((row) => row.key && row.value)
            .map((row) => [row.key, row.value])
    )
}

export function buildVariablePlan(rows: VariableRow[]) {
    const values: Record<string, string> = {}
    const warnings: string[] = []

    for (const row of rows) {
        const key = row.key.trim()
        if (!key && !row.value.trim()) {
            continue
        }

        if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) {
            warnings.push(`Skipped invalid variable name: ${key || '(empty)'}.`)
            continue
        }

        values[key] = row.value.trim()
    }

    return { values, warnings }
}

export function resolveTemplate(value: string, variables: Record<string, string>) {
    return value.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g, (match, key: string) => variables[key] ?? match)
}

export function findMissingVariables(value: string, variables: Record<string, string>) {
    const missing = new Set<string>()
    for (const match of value.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g)) {
        if (variables[match[1]] === undefined) {
            missing.add(`Missing variable: ${match[1]}.`)
        }
    }

    return Array.from(missing)
}
