export type SystemEventsRequestOptions = Pick<RequestInit, 'cache' | 'signal'>

export function fetchSystemEvents(apiBaseUrl: string, query: URLSearchParams | string, token: string, id: string, options: SystemEventsRequestOptions = {}) {
    return fetch(`${apiBaseUrl}/system/events?${query}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, id },
    })
}
