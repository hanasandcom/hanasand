export function impersonationEventsQuery(filters: Record<string, unknown>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue
        params.set(key, String(value))
    }
    const query = params.toString()
    return `/api/impersonation/events${query ? `?${query}` : ''}`
}
