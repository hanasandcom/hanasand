import config from '@/config'
import { getCookie } from 'hanasand/cookies'

type RateLimitRequestOptions = {
    method: 'POST' | 'PUT' | 'DELETE'
    fallbackMessage: string
    body?: unknown
}

export function rateLimitHeaders() {
    const token = getCookie('access_token')
    const id = getCookie('id')
    if (!token || !id) return null

    return { Authorization: `Bearer ${decodeURIComponent(token)}`, id }
}

export async function requestRateLimit<T = unknown>(path: string, authHeaders: Record<string, string>, options: RateLimitRequestOptions): Promise<T> {
    const headers = { ...authHeaders }
    const init: RequestInit = { method: options.method, headers }
    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json'
        init.body = JSON.stringify(options.body)
    }

    const response = await fetch(`${config.url.api}/rate-limit${path}`, init)
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || options.fallbackMessage)
    return payload as T
}
