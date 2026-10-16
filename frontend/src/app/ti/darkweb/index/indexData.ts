import { headers } from 'next/headers'
import type { DarkwebIndexFilters, DarkwebSearchResponse, DarkwebStatusResponse } from './indexTypes'

export function paramValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export function formatNumber(value: number | undefined, fallback = 'Checking') {
    return typeof value === 'number' ? new Intl.NumberFormat('en-US').format(value) : fallback
}

export function formatDate(value: string | undefined, fallback = 'Checking') {
    if (!value) return fallback
    const time = Date.parse(value)
    if (Number.isNaN(time)) return value
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(time))
}

export async function fetchDarkwebStatus(): Promise<DarkwebStatusResponse | null> {
    return fetchJson<DarkwebStatusResponse>('/v1/darkweb/status')
}

export async function fetchDarkwebSearch(filters: DarkwebIndexFilters): Promise<DarkwebSearchResponse | null> {
    const params = new URLSearchParams()
    params.set('limit', '50')
    if (filters.query) params.set('q', filters.query)
    if (filters.category) params.set('category', filters.category)
    if (filters.legalTriage) params.set('legalTriage', filters.legalTriage)
    if (filters.network) params.set('network', filters.network)
    if (filters.reviewState) params.set('reviewState', filters.reviewState)
    return fetchJson<DarkwebSearchResponse>(`/v1/darkweb/search?${params.toString()}`)
}

async function fetchJson<T>(path: string): Promise<T | null> {
    try {
        const incoming = await headers()
        const host = incoming.get('x-forwarded-host')?.split(',')[0]?.trim() || incoming.get('host')
        if (!host) return null
        const protocol = incoming.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'
        const proxyPath = path.replace(/^\/v1\/darkweb\//, '/api/ti/darkweb/')
        const response = await fetch(new URL(proxyPath, `${protocol}://${host}`), {
            cache: 'no-store', signal: AbortSignal.timeout(12_000),
        })
        if (!response.ok) return null
        return await response.json() as T
    } catch {
        return null
    }
}
