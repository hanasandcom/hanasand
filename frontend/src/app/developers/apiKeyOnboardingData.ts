export async function responseJson<T = Record<string, unknown>>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new Error(apiError(payload, response.status))
    return payload as T
}

function apiError(payload: Record<string, unknown>, status: number) {
    const error = payload.error
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
        return String((error as Record<string, unknown>).message)
    }
    return `Request failed with HTTP ${status}.`
}

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

export function formatApiKeyDate(value: string | null) {
    if (!value) return 'never'
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp) : 'unknown'
}
