import type { QueueStatus } from './types'

export { formatLocalDateTime as date } from '@/utils/date/formatLocalDateTime'

export type TimelinessFilters = { scope: 'tenant' | 'global', tenantId: string, status: '' | QueueStatus, query: string }

export function buildReadUrl({ scope, tenantId, status, query }: TimelinessFilters) {
    const params = new URLSearchParams({ scope, limit: '200' })
    if (scope === 'tenant') params.set('tenantId', tenantId.trim())
    if (status) params.set('status', status)
    if (query) params.set('q', query)
    return `/api/ti/timeliness?${params}`
}

export function buildWriteUrl(scope: TimelinessFilters['scope'], tenantId: string) {
    const params = new URLSearchParams({ scope })
    if (scope === 'tenant') params.set('tenantId', tenantId.trim())
    return `/api/ti/timeliness?${params}`
}

export function label(value: string) {
    return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

export function duration(value?: number | null) {
    if (value === undefined || value === null) return '—'
    if (value < 60) return `${value}s`
    if (value < 3600) return `${(value / 60).toFixed(1)}m`
    return `${(value / 3600).toFixed(1)}h`
}

export function percent(value?: number) {
    return value === undefined ? '—' : `${Math.round(value * 100)}%`
}

export function message(error: unknown) {
    return error instanceof Error ? error.message : 'The timeliness request failed.'
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: { 'content-type': 'application/json', ...init?.headers },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error?.message || 'The timeliness request failed.')
    return payload as T
}
