export type { ErrorEvent, ErrorEventsResponse } from './errorEvents'

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
    source: 'runtime' | 'native' | 'logs_ingestion'
}
