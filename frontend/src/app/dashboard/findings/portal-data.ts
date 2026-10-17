import type { Dispatch, SetStateAction } from 'react'
import type { DwmProductSnapshot } from '@/utils/dwm/product'
import type { PortalAlert, OperationsSnapshot, DeliveryItem, CasesState, CaseListItem } from './types'
import type { DwmDataHealth } from './view-types'

export function alertOrganizationId(alert: PortalAlert, fallback?: string) {
    return alert.organizationId || alert.workflowContext?.organizationId || fallback
}

export function dwmScopeSearchParams(tenantId: string, organizationId?: string) {
    const params = new URLSearchParams({ tenantId })
    if (organizationId) params.set('organizationId', organizationId)
    return params
}

async function refreshDwmResource<TValue, TPayload>(
    path: string,
    resource: keyof DwmDataHealth,
    labels: { live: string, unavailable: string },
    signal: AbortSignal,
    setValue: Dispatch<SetStateAction<TValue>>,
    mapPayload: (payload: TPayload) => { value: TValue, detail: string },
    setDataHealth: Dispatch<SetStateAction<DwmDataHealth>>,
) {
    try {
        const result = mapPayload(await fetchFindingsJson<TPayload>(path, signal))
        setValue(result.value)
        setDataHealth(current => ({ ...current, [resource]: { state: 'live', label: labels.live, detail: result.detail } }))
    } catch (error) {
        if (!isAbortError(error)) setDataHealth(current => ({ ...current, [resource]: { state: 'error', label: labels.unavailable, detail: requestFailureDetail(error) } }))
    }
}

export async function refreshDwmProduct(
    params: URLSearchParams,
    signal: AbortSignal,
    setSnapshot: Dispatch<SetStateAction<DwmProductSnapshot>>,
    setDataHealth: Dispatch<SetStateAction<DwmDataHealth>>,
) {
    return refreshDwmResource<DwmProductSnapshot, DwmProductSnapshot>(
        `/api/findings/product?${params.toString()}`, 'snapshot',
        { live: 'Dark web stream live', unavailable: 'Monitoring unavailable' }, signal,
        setSnapshot, value => ({ value, detail: 'The exposure monitor is showing live watchlists, sources, actors, and events.' }), setDataHealth,
    )
}

export async function refreshDwmOperations(
    params: URLSearchParams,
    signal: AbortSignal,
    setOperations: Dispatch<SetStateAction<OperationsSnapshot | null>>,
    setDataHealth: Dispatch<SetStateAction<DwmDataHealth>>,
) {
    return refreshDwmResource<OperationsSnapshot | null, OperationsSnapshot>(
        `/api/findings/operations?${params.toString()}`, 'operations',
        { live: 'Collection live', unavailable: 'Collection unavailable' }, signal,
        setOperations, value => ({ value, detail: 'Collection is showing source and evidence state.' }), setDataHealth,
    )
}

export async function refreshDwmAlerts(
    params: URLSearchParams,
    signal: AbortSignal,
    setAlerts: Dispatch<SetStateAction<PortalAlert[]>>,
    setDataHealth: Dispatch<SetStateAction<DwmDataHealth>>,
) {
    return refreshDwmResource<PortalAlert[], { alerts?: PortalAlert[] }>(
        `/api/findings/alerts?${params.toString()}`, 'alerts',
        { live: 'Events live', unavailable: 'Events unavailable' }, signal,
        setAlerts, payload => {
            const value = payload.alerts || []
            return { value, detail: `${value.length} recorded events.` }
        }, setDataHealth,
    )
}

export async function refreshCases(
    params: URLSearchParams,
    signal: AbortSignal,
    setCasesState: Dispatch<SetStateAction<CasesState>>,
) {
    setCasesState(current => ({ status: 'loading', rows: current.rows }))
    for (const delayMs of [0, 2000, 5000, 10000, 20000, 30000]) {
        try {
            if (delayMs) await waitForRetry(delayMs, signal)
            const response = await fetch(`/api/cases?${params.toString()}`, { cache: 'no-store', signal })
            if (response.status >= 500) {
                if (delayMs < 30000) continue
            }
            if (!response.ok) {
                const error = await responseProblem(response)
                setCasesState(current => ({ status: 'error', rows: current.rows, error }))
                return
            }
            const payload = await response.json() as { items?: CaseListItem[], cases?: CaseListItem[], total?: number }
            const rows = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.cases) ? payload.cases : []
            const total = Number.isFinite(payload.total) ? Math.max(rows.length, Number(payload.total)) : rows.length
            setCasesState({ status: 'ready', rows, total })
            return
        } catch (error) {
            if (isAbortError(error)) return
            if (delayMs === 30000) {
                setCasesState(current => ({ status: 'error', rows: current.rows, error: requestFailureDetail(error) }))
                return
            }
        }
    }
}

function waitForRetry(delayMs: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer)
            reject(new DOMException('The request was aborted.', 'AbortError'))
        }
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
        }, delayMs)
        signal.addEventListener('abort', onAbort, { once: true })
        if (signal.aborted) onAbort()
    })
}

export async function refreshDwmDeliveries(
    params: URLSearchParams,
    signal: AbortSignal,
    setLocalDeliveries: Dispatch<SetStateAction<DeliveryItem[]>>,
    setDataHealth: Dispatch<SetStateAction<DwmDataHealth>>,
) {
    return refreshDwmResource<DeliveryItem[], { deliveries?: DeliveryItem[] }>(
        `/api/findings/webhooks/deliveries?${params.toString()}`, 'deliveries',
        { live: 'Deliveries live', unavailable: 'Deliveries unavailable' }, signal,
        setLocalDeliveries, payload => {
            const value = payload.deliveries || []
            return { value, detail: `${value.length} delivery attempt(s).` }
        }, setDataHealth,
    )
}

export function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError'
}

export async function fetchFindingsJson<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(url, { cache: 'no-store', signal })
    if (!response.ok) throw new Error(await responseProblem(response))
    return await response.json() as T
}

export async function responseProblem(response: Response) {
    const payload = await response.json().catch(() => ({})) as { error?: string | { message?: string }, message?: string }
    if (typeof payload.error === 'string') return payload.error
    return payload.error?.message || payload.message || `Request failed with status ${response.status}.`
}

export function requestFailureDetail(error: unknown) {
    return error instanceof Error && error.message ? error.message : 'The live DWM service could not be reached.'
}

export function scopeBody<T extends Record<string, unknown>>(body: T, tenantId: string, organizationId?: string) {
    return organizationId ? { ...body, tenantId, organizationId } : { ...body, tenantId }
}
