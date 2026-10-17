import { afterAll, expect, test } from 'bun:test'
import type { Dispatch, SetStateAction } from 'react'
import { fetchFindingsJson, refreshDwmAlerts, refreshDwmDeliveries, refreshDwmOperations, refreshDwmProduct } from '../src/app/dashboard/findings/portal-data'
import { firstSearchParam } from '../src/app/dashboard/findings/searchParams'
import type { DwmProductSnapshot } from '../src/utils/dwm/product'
import type { DataHealthItem, DwmDataHealth } from '../src/app/dashboard/findings/view-types'
import type { DeliveryItem, OperationsSnapshot, PortalAlert } from '../src/app/dashboard/findings/types'

const originalFetch = globalThis.fetch
afterAll(() => { globalThis.fetch = originalFetch })

test('findings routes use the first search parameter value and ignore empty repeats', () => {
    expect(firstSearchParam('watchlists')).toBe('watchlists')
    expect(firstSearchParam(['actions', 'ignored'])).toBe('actions')
    expect(firstSearchParam(['', 'ignored'])).toBeUndefined()
    expect(firstSearchParam(undefined)).toBeUndefined()
})

test('shared findings JSON requests retain no-store, abort, and response-error behavior', async () => {
    const signal = new AbortController().signal
    let request: { url: string, cache?: RequestCache, signal?: AbortSignal } | undefined
    globalThis.fetch = (async (input, init) => {
        request = { url: String(input), cache: init?.cache, signal: init?.signal as AbortSignal }
        return Response.json({ marker: 'watchlist' })
    }) as typeof fetch

    await expect(fetchFindingsJson<{ marker: string }>('/api/findings/watchlist-overview?tenantId=tenant-1', signal)).resolves.toEqual({ marker: 'watchlist' })
    expect(request).toEqual({ url: '/api/findings/watchlist-overview?tenantId=tenant-1', cache: 'no-store', signal })

    globalThis.fetch = (async () => Response.json({ error: { message: 'upstream denied' } }, { status: 403 })) as typeof fetch
    await expect(fetchFindingsJson('/api/findings/watchlist-overview', signal)).rejects.toThrow('upstream denied')
})

function state<T>(initial: T) {
    let value = initial
    return {
        get: () => value,
        set: ((next: SetStateAction<T>) => { value = typeof next === 'function' ? next(value) : next }) as Dispatch<SetStateAction<T>>,
    }
}

function initialHealth(): DwmDataHealth {
    const missing: DataHealthItem = { state: 'missing', label: '', detail: '' }
    return { snapshot: missing, operations: missing, alerts: missing, deliveries: missing }
}

test('findings resources keep no-store requests, payload mapping, and live health details', async () => {
    const snapshot = { marker: 'snapshot' } as unknown as DwmProductSnapshot
    const operations = { marker: 'operations' } as unknown as OperationsSnapshot
    const requests: Array<{ url: string, cache: RequestCache | undefined, signal: AbortSignal | undefined }> = []
    globalThis.fetch = (async (input, init) => {
        requests.push({ url: String(input), cache: init?.cache, signal: init?.signal as AbortSignal })
        if (String(input).includes('/product?')) return Response.json(snapshot)
        if (String(input).includes('/operations?')) return Response.json(operations)
        return Response.json({})
    }) as typeof fetch

    const params = new URLSearchParams({ tenantId: 'tenant-1' })
    const signal = new AbortController().signal
    const product = state(snapshot)
    const operationState = state<OperationsSnapshot | null>(null)
    const alerts = state<PortalAlert[]>([{ id: 'old' } as PortalAlert])
    const deliveries = state<DeliveryItem[]>([{ id: 'old' } as DeliveryItem])
    const health = state(initialHealth())

    await Promise.all([
        refreshDwmProduct(params, signal, product.set, health.set),
        refreshDwmOperations(params, signal, operationState.set, health.set),
        refreshDwmAlerts(params, signal, alerts.set, health.set),
        refreshDwmDeliveries(params, signal, deliveries.set, health.set),
    ])

    expect(product.get()).toEqual(snapshot)
    expect(operationState.get()).toEqual(operations)
    expect(alerts.get()).toEqual([])
    expect(deliveries.get()).toEqual([])
    expect(requests).toHaveLength(4)
    expect(requests.every(request => request.cache === 'no-store' && request.signal === signal)).toBe(true)
    expect(health.get()).toMatchObject({
        snapshot: { state: 'live', label: 'Dark web stream live' },
        operations: { state: 'live', label: 'Collection live' },
        alerts: { state: 'live', label: 'Events live', detail: '0 recorded events.' },
        deliveries: { state: 'live', label: 'Deliveries live', detail: '0 delivery attempt(s).' },
    })
})

test('failed requests retain the existing resource error details and aborts stay quiet', async () => {
    globalThis.fetch = (async (input) => String(input).includes('/product?')
        ? Response.json({ error: { message: 'upstream denied' } }, { status: 403 })
        : Promise.reject(new DOMException('aborted', 'AbortError'))) as typeof fetch

    const params = new URLSearchParams({ tenantId: 'tenant-1' })
    const snapshot = state({ marker: 'unchanged' } as unknown as DwmProductSnapshot)
    const operations = state<OperationsSnapshot | null>(null)
    const health = state(initialHealth())
    await refreshDwmProduct(params, new AbortController().signal, snapshot.set, health.set)
    const afterFailure = health.get()
    await refreshDwmOperations(params, new AbortController().signal, operations.set, health.set)

    expect(snapshot.get()).toEqual({ marker: 'unchanged' })
    expect(health.get().snapshot).toEqual({ state: 'error', label: 'Monitoring unavailable', detail: 'upstream denied' })
    expect(health.get().operations).toBe(afterFailure.operations)
})
