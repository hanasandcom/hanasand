import type { ToolResponse } from './types'

const SENSITIVE_HEADER_NAMES = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization'])

export function sanitizeToolResponse(response: ToolResponse): ToolResponse {
    const request = response.request
        ? {
            ...response.request,
            headers: redactHeaders(response.request.headers) ?? {},
        }
        : undefined

    return {
        ...response,
        error: response.error ? redactSensitiveText(response.error) : undefined,
        body: response.body ? redactSensitiveText(response.body) : response.body,
        raw: response.raw ? redactSensitiveText(response.raw) : response.raw,
        headers: response.headers ? redactHeaders(response.headers) : response.headers,
        request,
    }
}

export function redactHeaders(headers?: Record<string, string>) {
    if (!headers) {
        return headers
    }

    return Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
            key,
            SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? '[redacted]' : redactSensitiveText(value),
        ])
    )
}

export function redactSensitiveText(value: string) {
    return value.replace(/\bBearer\s+[^'\s]+/gi, 'Bearer [redacted]')
}
