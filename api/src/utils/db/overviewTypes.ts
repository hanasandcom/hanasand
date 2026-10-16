import type { DatabaseStorage } from './storage.ts'

export type QueryParams = Array<string | number | boolean | null>

export type MetricsQuery = <T extends Record<string, unknown>>(query: string, params?: QueryParams) => Promise<{ rows: T[] }>

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

export type DatabaseOverview = {
    storage?: DatabaseStorage | null
    status: 'healthy' | 'unavailable'
    generatedAt: string
    clusterCount: number | null
    databaseCount: number | null
    totalSizeBytes: number | null
    activeQueries: number | null
    averageQuerySeconds: number | null
    longRunningThresholdSeconds: number
    longestQuery: DatabaseQueryActivity | null
    queries: DatabaseQueryActivity[]
    health: {
        message: string
        detail?: string
        category?: 'auth' | 'network' | 'permission' | 'unknown'
    }
    clusters: Array<{
        id: string
        name: string
        engine: string
        version: string
        host: string
        activeQueries: number
        totalSizeBytes: number
        databaseCount: number
        error?: string | null
        databases: Array<{
            name: string
            sizeBytes: number
            tableCount: number | null
            activeConnections: number
            tables?: Array<{ schema: string, name: string, estimatedRows: number | null }>
        }>
    }>
}

export type ServerRow = {
    current_database: string
    host: string | null
    port: number | null
    version: string
}

export type DatabaseRow = {
    name: string
    size_bytes: string | number | null
    table_count: string | number | null
    active_connections: string | number | null
}

export type ActivityRow = {
    database: string | null
    user_name: string | null
    state: string | null
    duration_seconds: string | number | null
    wait_event_type: string | null
    wait_event: string | null
    query: string | null
}

export type TableRow = {
    schema_name: string
    table_name: string
    estimated_rows: string | number | null
}
