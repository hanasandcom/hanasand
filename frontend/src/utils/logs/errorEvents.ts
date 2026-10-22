export type ErrorEvent = {
    id: string
    source: 'api' | 'auth' | 'traffic'
    service: string
    surface: string
    method: string
    path: string
    status_code: number
    error_code: string
    message: string
    request_id: string
    user_id: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    created_at: string
}

export type ErrorEventSummary = {
    total: number
    last_hour: number
    last_24h: number
    server_errors: number
    client_errors: number
    status_counts: Array<{ status_code: number, count: number }>
    surface_counts: Array<{ surface: string, count: number }>
    code_counts: Array<{ error_code: string, count: number }>
}

export type ErrorEventsResponse = { generated_at: string, summary: ErrorEventSummary | null, summary_available?: boolean, summary_checked_at?: string, summary_warning?: string, warnings?: string[], errors: ErrorEvent[] }

export function emptyErrorEvents(): ErrorEventsResponse {
    return {
        generated_at: '',
        summary: null,
        summary_available: false,
        errors: [],
    }
}
