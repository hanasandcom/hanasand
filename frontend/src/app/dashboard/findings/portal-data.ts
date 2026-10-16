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

export async function refreshDwmProduct(
    params: URLSearchParams,
    signal: AbortSignal,
    setSnapshot: Dispatch<SetStateAction<DwmProductSnapshot>>,
    setDataHealth: Dispatch<SetStateAction<DwmDataHealth>>,
) {
    try {
        setSnapshot(await fetchFindingsJson<DwmProductSnapshot>(`/api/findings/product?${params.toString()}`, signal))
        setDataHealth(current => ({ ...current, snapshot: { state: 'live', label: 'Dark web stream live', detail: 'The exposure monitor is showing live watchlists, sources, actors, and events.' } }))
    } catch (error) {
        if (!isAbortError(error)) setDataHealth(current => ({ ...current, snapshot: { state: 'error', label: 'Monitoring unavailable', detail: requestFailureDetail(error) } }))
    }
}

export async function refreshDwmOperations(
    params: URLSearchParams,
    signal: AbortSignal,
    setOperations: Dispatch<SetStateAction<OperationsSnapshot | null>>,
    setDataHealth: Dispatch<SetStateAction<DwmDataHealth>>,
) {
    try {
        setOperations(await fetchFindingsJson<OperationsSnapshot>(`/api/findings/operations?${params.toString()}`, signal))
        setDataHealth(current => ({ ...current, operations: { state: 'live', label: 'Collection live', detail: 'Collection is showing source and evidence state.' } }))
    } catch (error) {
        if (!isAbortError(error)) setDataHealth(current => ({ ...current, operations: { state: 'error', label: 'Collection unavailable', detail: requestFailureDetail(error) } }))
    }
}

export async function refreshDwmAlerts(
    params: URLSearchParams,
    signal: AbortSignal,
    setAlerts: Dispatch<SetStateAction<PortalAlert[]>>,
    setDataHealth: Dispatch<SetStateAction<DwmDataHealth>>,
) {
    try {
        const payload = await fetchFindingsJson<{ alerts?: PortalAlert[] }>(`/api/findings/alerts?${params.toString()}`, signal)
        const savedAlerts = payload.alerts || []
        setAlerts(savedAlerts)
        setDataHealth(current => ({ ...current, alerts: { state: 'live', label: 'Events live', detail: `${savedAlerts.length} recorded events.` } }))
    } catch (error) {
        if (!isAbortError(error)) setDataHealth(current => ({ ...current, alerts: { state: 'error', label: 'Events unavailable', detail: requestFailureDetail(error) } }))
    }
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
    try {
        const payload = await fetchFindingsJson<{ deliveries?: DeliveryItem[] }>(`/api/findings/webhooks/deliveries?${params.toString()}`, signal)
        const deliveries = payload.deliveries || []
        setLocalDeliveries(deliveries)
        setDataHealth(current => ({ ...current, deliveries: { state: 'live', label: 'Deliveries live', detail: `${deliveries.length} delivery attempt(s).` } }))
    } catch (error) {
        if (!isAbortError(error)) setDataHealth(current => ({ ...current, deliveries: { state: 'error', label: 'Deliveries unavailable', detail: requestFailureDetail(error) } }))
    }
}

export function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError'
}

async function fetchFindingsJson<T>(url: string, signal: AbortSignal): Promise<T> {
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
