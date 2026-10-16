import { readDatabaseStorage } from './storage.ts'
import type { QueryParams } from './overviewTypes.ts'
import { collectDatabaseOverview } from './overviewMetrics.ts'

const DATABASE_OVERVIEW_REFRESH_MS = 10_000

type LiveDatabaseOverview = Awaited<ReturnType<typeof collectLiveDatabaseOverview>>

let cachedDatabaseOverview: { value: LiveDatabaseOverview, refreshedAt: number } | null = null

let refreshingDatabaseOverview: Promise<LiveDatabaseOverview> | null = null

let lastDatabaseOverviewRefreshAttemptAt = 0

export async function collectLiveDatabaseOverview() {
    const { queryOnce } = await import('#db')
    const [overview, storage] = await Promise.all([collectDatabaseOverview(async <T extends Record<string, unknown>>(query: string, params?: QueryParams) => {
        const result = await queryOnce(query, params)
        return { rows: result.rows as T[] }
    }), readDatabaseStorage()])
    return { ...overview, storage }
}

async function refreshDatabaseOverview(): Promise<LiveDatabaseOverview> {
    if (refreshingDatabaseOverview) return refreshingDatabaseOverview
    lastDatabaseOverviewRefreshAttemptAt = Date.now()
    const refresh = collectLiveDatabaseOverview().then(value => {
        if (value.status === 'healthy' || !cachedDatabaseOverview) {
            cachedDatabaseOverview = { value, refreshedAt: Date.now() }
        }
        return value
    })
    refreshingDatabaseOverview = refresh
    try {
        return await refresh
    } finally {
        if (refreshingDatabaseOverview === refresh) refreshingDatabaseOverview = null
    }
}

export async function getCachedDatabaseOverview(): Promise<LiveDatabaseOverview> {
    if (!cachedDatabaseOverview) return refreshDatabaseOverview()
    if (Date.now() - Math.max(cachedDatabaseOverview.refreshedAt, lastDatabaseOverviewRefreshAttemptAt) >= DATABASE_OVERVIEW_REFRESH_MS) {
        void refreshDatabaseOverview().catch(() => undefined)
    }
    return cachedDatabaseOverview.value
}

export async function warmDatabaseOverview(): Promise<LiveDatabaseOverview> {
    return refreshDatabaseOverview()
}

export function startDatabaseOverviewRefresh(onError: (error: unknown) => void = () => undefined) {
    const refresh = () => { void refreshDatabaseOverview().catch(onError) }
    const timer = setInterval(refresh, DATABASE_OVERVIEW_REFRESH_MS)
    timer.unref()
    return () => clearInterval(timer)
}
