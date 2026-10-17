export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogRecordEntry = {
    service?: string
    host?: string
    level: LogLevel
    message: string
    metadata?: Record<string, unknown>
    sourceEventId?: string
    timestamp?: string
}

export type PreparedLog = [
    service: string,
    host: string,
    level: LogLevel,
    message: string,
    metadataJson: string,
    scopeId: string | null,
    sourceEventId: string,
    timestamp: string | null,
    id: string,
] | undefined
