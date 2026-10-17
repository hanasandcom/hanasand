import config from '#constants'
import type { NativeLogEntry } from './nativeEntry.ts'

async function fetchRemoteJson<T>(path: string, params: URLSearchParams): Promise<T | null> {
    if (!config.internal_api || !config.vm_api_token) return null
    try {
        const response = await fetch(`${config.internal_api}${path}?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                'Content-Type': 'application/json',
                'User-Agent': 'hanasand_api',
            },
            signal: AbortSignal.timeout(2000),
        })
        if (!response.ok) return null
        return await response.json() as T
    } catch {
        return null
    }
}

export async function fetchRemoteNativeLogs({ service, level, search, limit }: {
    service?: string | null
    level?: string | null
    search?: string | null
    limit: number
}) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (service) params.set('service', service)
    if (level) params.set('level', level)
    if (search) params.set('search', search)
    const payload = await fetchRemoteJson<{ logs?: NativeLogEntry[] }>('/logs', params)
    return Array.isArray(payload?.logs) ? payload.logs.map((entry) => ({
        ...entry,
        metadata: { ...(entry.metadata || {}), native_source: 'internal_api' },
        source: 'native' as const,
    })) : []
}

export async function fetchRemoteNativeLogServices(limit: number) {
    const payload = await fetchRemoteJson<{ services?: Array<{ service: string, last_seen: string, entries: number }> }>(
        '/logs/services', new URLSearchParams({ limit: String(limit) })
    )
    return Array.isArray(payload?.services) ? payload.services : []
}
