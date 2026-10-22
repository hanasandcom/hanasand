import { getCookie } from 'hanasand/cookies'

export function backendRequestHeaders(overrides?: HeadersInit) {
    const headers = new Headers({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getCookie('access_token') || ''}`,
        id: getCookie('id') || '',
    })

    if (overrides) {
        new Headers(overrides).forEach((value, name) => headers.set(name, value))
    }

    return Object.fromEntries(headers.entries())
}
