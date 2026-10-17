export async function requestJson<T>(url: string, init: RequestInit = {}) {
    const response = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status})`)
    }
    return payload as T
}
