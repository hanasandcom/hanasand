import { logSearchParams, logTables, type LogSearchResult } from './search'
import config from '@/config'
export { emptyErrorEvents, getErrorEvents } from './errorEvents'
export type { ErrorEvent, ErrorEventSummary, ErrorEventsResponse } from './errorEvents'

export type ServiceLog = {
    id: number | string
    service: string
    host: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    metadata: Record<string, unknown>
    created_at: string
    source?: 'stored' | 'native'
}

export type LogService = {
    service: string
    last_seen: string
    entries: number
}

export type RuntimeLog = {
    id: string
    container_id?: string
    service: string
    image?: string
    host?: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    metadata?: Record<string, unknown>
    created_at: string
    source: 'runtime' | 'native'
}

export type LogRealtimeResponse = {
    logs: RuntimeLog[]
    containers: DockerContainer[]
    runtime_available: boolean
    native_available?: boolean
    generated_at: string
    unavailable_reason?: string
}

export async function getLogs({ token, id, service, level = 'error' }: { token?: string, id?: string, service?: string, level?: string }) {
    if (!token || !id) return []
    const params = new URLSearchParams({ level, limit: '500' })
    if (service) params.set('service', service)
    try {
        const response = await fetch(`${config.url.api}/logs?${params.toString()}`, {
            next: { revalidate: 5 },
            headers: { id, Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return []
        const body = await response.json()
        return Array.isArray(body.logs) ? body.logs as ServiceLog[] : []
    } catch {
        return []
    }
}

export async function getLogServices({ token, id }: { token?: string, id?: string }) {
    if (!token || !id) return []
    try {
        const response = await fetch(`${config.url.api}/logs/services`, {
            next: { revalidate: 5 },
            headers: { id, Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return []
        const body = await response.json()
        return Array.isArray(body.services) ? body.services as LogService[] : []
    } catch {
        return []
    }
}

export async function getRealtimeLogs({ token, id, service }: { token?: string, id?: string, service?: string }) {
    if (!token || !id) {
        return {
            logs: [],
            containers: [],
            runtime_available: false,
            generated_at: new Date().toISOString(),
        } satisfies LogRealtimeResponse
    }

    const params = new URLSearchParams({ limit: '300' })
    if (service) params.set('service', service)
    try {
        const response = await fetch(`${config.url.api}/logs/realtime?${params.toString()}`, {
            next: { revalidate: 5 },
            headers: { id, Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
            return {
                logs: [],
                containers: [],
                runtime_available: false,
                generated_at: new Date().toISOString(),
            } satisfies LogRealtimeResponse
        }

        const body = await response.json()
        return {
            logs: Array.isArray(body.logs) ? body.logs as RuntimeLog[] : [],
            containers: Array.isArray(body.containers) ? body.containers as DockerContainer[] : [],
            runtime_available: Boolean(body.runtime_available),
            native_available: Boolean(body.native_available),
            generated_at: typeof body.generated_at === 'string' ? body.generated_at : new Date().toISOString(),
            unavailable_reason: typeof body.unavailable_reason === 'string' ? body.unavailable_reason : undefined,
        } satisfies LogRealtimeResponse
    } catch {
        return {
            logs: [],
            containers: [],
            runtime_available: false,
            generated_at: new Date().toISOString(),
            unavailable_reason: 'Log stream is reconnecting.',
        } satisfies LogRealtimeResponse
    }
}

export async function getLogDashboard({ token, id, params, impersonationToken, view = 'dashboard' }: { view?: 'dashboard' | 'realtime' | 'search' | 'errors', token: string, id: string, params: Record<string, string | string[] | undefined>, impersonationToken?: string }): Promise<{ data: LogSearchResult | null, error: string }> {
    const value = (key: string) => { const input = params[key]; return (Array.isArray(input) ? input[0] : input) || '' }
    const appliedHql = value('hql') || value('kql')
    const query = logSearchParams({ view, hours: value('hours') || '24', advanced: !!appliedHql,
        appliedHql, table: logTables.includes(value('table')) ? value('table') : 'Logs', search: value('search'),
        service: value('service') || 'all', severity: value('severity') || 'all' })
    try {
        const response = await fetch(`${config.url.api}/logs/search?${query}`, {
            cache: 'no-store', signal: AbortSignal.timeout(10_000),
            headers: { id, Authorization: `Bearer ${token}`, ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}) },
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Could not load logs.')
        if (!Array.isArray(body.rows) || !Array.isArray(body.counts) || !Array.isArray(body.services)) throw new Error('Could not load logs.')
        return { data: body as LogSearchResult, error: '' }
    } catch (cause) {
        return { data: null, error: cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'Could not load logs.' }
    }
}
