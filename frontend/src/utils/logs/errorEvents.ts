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
    project_scans: number
    share_scans: number
}

export type ErrorEventsResponse = { generated_at: string, summary: ErrorEventSummary, errors: ErrorEvent[] }

export function emptyErrorEvents(): ErrorEventsResponse {
    return {
        generated_at: new Date().toISOString(),
        summary: {
            total: 0,
            last_hour: 0,
            last_24h: 0,
            server_errors: 0,
            client_errors: 0,
            status_counts: [],
            surface_counts: [],
            code_counts: [],
            project_scans: 0,
            share_scans: 0,
        },
        errors: [],
    }
}
