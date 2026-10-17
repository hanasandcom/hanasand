import { mergeLogServices } from './services.ts'
import { dedupeLogs } from './nativeEntry.ts'
import { isNativeLogSourceAvailable, listLocalNativeLogs } from './nativeLocal.ts'
import { fetchRemoteNativeLogServices, fetchRemoteNativeLogs } from './nativeRemote.ts'

export type { NativeLogEntry } from './nativeEntry.ts'
export { isNativeLogSourceAvailable }

export async function listNativeLogs({ service, level, search, limit = 200 }: {
    service?: string | null
    level?: string | null
    search?: string | null
    limit?: number
}) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 500)
    const [localLogs, remoteLogs] = await Promise.all([
        listLocalNativeLogs({ service, level, search, limit: normalizedLimit }),
        fetchRemoteNativeLogs({ service, level, search, limit: normalizedLimit }),
    ])
    return dedupeLogs([...localLogs, ...remoteLogs])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, normalizedLimit)
}

export async function listNativeLogServices(limit = 200) {
    const [logs, remoteServices] = await Promise.all([
        listLocalNativeLogs({ limit }),
        fetchRemoteNativeLogServices(limit),
    ])
    return mergeLogServices([[
        ...logs.map((log) => ({ service: log.service, last_seen: log.created_at, entries: 1 })),
        ...remoteServices,
    ]])
}
