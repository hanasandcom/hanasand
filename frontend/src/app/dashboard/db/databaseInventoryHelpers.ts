import type { Page, Sort } from './databaseInventoryTypes'

export function nextSort<K extends string>(sort: Sort<K>, key: K): Sort<K> {
    return { key, descending: sort.key === key ? !sort.descending : false }
}

export function compare(a: string | number | null | undefined, b: string | number | null | undefined, descending: boolean) {
    if (a == null) return b == null ? 0 : 1
    if (b == null) return -1
    return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true })) * (descending ? -1 : 1)
}


export async function fetchPage(params: URLSearchParams, signal?: AbortSignal): Promise<Page> {
    const response = await fetch(`/api/db/browse?${params}`, { cache: 'no-store', signal })
    const body = await response.json()
    if (!response.ok) throw new Error(body.message || 'Preview unavailable.')
    return body
}


export function cell(value: unknown) { return value == null ? 'null' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value) }
export function displayCell(field: string, value: string) { return field.toLowerCase() === 'id' ? value.replace(/^0+(?=.)/, '') : value }
