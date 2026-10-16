export type DatabaseOverview = {
    storage?: {
        sampledAt: string
        host: string
        stale?: boolean
        disk: { totalBytes: number, availableBytes: number, dailyGrowthBytes: number | null, daysUntilFull: number | null, sampleSeconds: number }
        instances: Array<{
            id: string
            engine: string
            status: 'healthy' | 'unhealthy' | 'unavailable'
            databases: Array<{ name: string, sizeBytes: number | null, connections: number | null, replica?: boolean, memory?: boolean, tableCount?: number | null, tables?: Array<{ schema: string, name: string, sizeBytes: number, estimatedRows: number, columns: string[], lastWriteObservedAt: string | null }> }>
        }>
    } | null
    status: 'healthy' | 'unavailable'
    generatedAt: string
    clusterCount: number | null
    databaseCount: number | null
    totalSizeBytes: number | null
    activeQueries: number | null
    averageQuerySeconds: number | null
    longRunningThresholdSeconds: number
    longestQuery?: DatabaseQueryActivity | null
    queries: DatabaseQueryActivity[]
    querySummary?: { count: number, longRunningCount: number, longestDurationSeconds: number | null }
    health: {
        message: string
        detail?: string
        category?: 'auth' | 'network' | 'permission' | 'unknown'
    }
    clusters: Array<{
        id: string
        name: string
        engine?: string
        version?: string
        host?: string
        activeQueries: number
        totalSizeBytes: number
        databaseCount: number
        error?: string | null
        databases: Array<{
            name: string
            sizeBytes: number
            tableCount: number | null
            activeConnections?: number
            tables?: Array<{ schema: string, name: string, estimatedRows: number | null }>
        }>
    }>
}

export type DatabaseQueryActivity = {
    database: string | null
    user: string | null
    state: string | null
    durationSeconds: number | null
    waitEventType: string | null
    waitEvent: string | null
    query: string | null
    isLongRunning: boolean
}
export type DatabaseQueryResult = {
    rows: Record<string, unknown>[]
    rowCount: number
    fields: string[]
}

export type DatabaseHealth = {
    ok: boolean
    database?: string
    checked_at?: string
    message?: string
}
