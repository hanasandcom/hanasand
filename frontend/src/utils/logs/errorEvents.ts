import config from '@/config'

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

export async function getErrorEvents({ token, id }: { token?: string, id?: string }) {
    if (!token || !id) return emptyErrorEvents()
    try {
        const response = await fetch(`${config.url.api}/logs/errors?limit=150`, {
            next: { revalidate: 5 }, headers: { id, Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return emptyErrorEvents()
        const body = await response.json()
        return {
            generated_at: typeof body.generated_at === 'string' ? body.generated_at : new Date().toISOString(),
            summary: normalizeSummary(body.summary),
            errors: Array.isArray(body.errors) ? body.errors as ErrorEvent[] : [],
        } satisfies ErrorEventsResponse
    } catch {
        return emptyErrorEvents()
    }
}

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

function normalizeSummary(value: unknown): ErrorEventSummary {
    const summary = value && typeof value === 'object' ? value as Partial<ErrorEventSummary> : {}
    return {
        total: numberValue(summary.total), last_hour: numberValue(summary.last_hour), last_24h: numberValue(summary.last_24h),
        server_errors: numberValue(summary.server_errors), client_errors: numberValue(summary.client_errors),
        status_counts: Array.isArray(summary.status_counts) ? summary.status_counts : [],
        surface_counts: Array.isArray(summary.surface_counts) ? summary.surface_counts : [],
        code_counts: Array.isArray(summary.code_counts) ? summary.code_counts : [],
        project_scans: numberValue(summary.project_scans), share_scans: numberValue(summary.share_scans),
    }
}

function numberValue(value: unknown) {
    const number = Number(value || 0)
    return Number.isFinite(number) ? number : 0
}
