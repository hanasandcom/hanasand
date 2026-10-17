export type CaseRequestErrorPolicy = 'string' | 'truthy'

export async function requestCaseJson<T>(
    url: string,
    init: RequestInit | undefined,
    fallback: string,
    errorPolicy: CaseRequestErrorPolicy = 'string',
): Promise<T> {
    const response = await fetch(url, { cache: 'no-store', ...init })
    const payload: unknown = await response.json()

    if (!response.ok) {
        throw new Error(getErrorMessage(payload, fallback, errorPolicy))
    }

    return payload as T
}

export function isCurrentCaseGeneration(current: number, requested: number) {
    return current === requested
}

export function isActiveCaseRequest(current: number, requested: number, signal: AbortSignal) {
    return isCurrentCaseGeneration(current, requested) && !signal.aborted
}

function getErrorMessage(payload: unknown, fallback: string, policy: CaseRequestErrorPolicy) {
    const error = getPayloadError(payload)

    if (policy === 'truthy') {
        return error ? String(error) : fallback
    }

    return typeof error === 'string' ? error : fallback
}

function getPayloadError(payload: unknown) {
    if (!payload || typeof payload !== 'object' || !('error' in payload)) {
        return undefined
    }
    return payload.error
}
