// @ts-expect-error Bun supplies this module when running tests.
import { expect, test } from 'bun:test'
import { fetchTrafficSnapshot, startTrafficSnapshotRefresh } from '../src/components/monitoring/traffic/trafficSnapshotRefresh'

function response(ok: boolean, body: unknown, status = ok ? 200 : 503): Response {
    return { ok, status, json: async () => body } as Response
}

function installFakes() {
    const original = {
        fetch: globalThis.fetch,
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
    }
    const scheduled: Array<() => Promise<void>> = []
    const delays: number[] = []
    const cleared: ReturnType<typeof setTimeout>[] = []
    const requests: Array<{ url: string, cache?: RequestCache }> = []
    let nextResponse: () => Promise<Response> = async () => response(true, { records: { result: [], total: 0 } })

    globalThis.setTimeout = ((handler: TimerHandler, delay?: number) => {
        scheduled.push(handler as () => Promise<void>)
        delays.push(delay ?? 0)
        return scheduled.length as unknown as ReturnType<typeof setTimeout>
    }) as typeof setTimeout
    globalThis.clearTimeout = ((timer: ReturnType<typeof setTimeout>) => { cleared.push(timer) }) as typeof clearTimeout
    globalThis.fetch = async (input, init) => {
        requests.push({ url: String(input), cache: init?.cache })
        return nextResponse()
    }

    return {
        scheduled, delays, cleared, requests,
        setResponse: (next: Promise<Response> | Response) => { nextResponse = () => Promise.resolve(next) },
        restore: () => {
            globalThis.fetch = original.fetch
            globalThis.setTimeout = original.setTimeout
            globalThis.clearTimeout = original.clearTimeout
        },
    }
}

test('traffic snapshot polling retries a failed request without replacing last-good data', async () => {
    const fake = installFakes()
    const applied: unknown[] = []
    try {
        const stop = startTrafficSnapshotRefresh('example.test', snapshot => applied.push(snapshot), 100)
        expect(fake.delays[0]).toBe(30_000)
        await fake.scheduled[0]()
        expect(fake.requests[0]).toEqual({
            url: '/api/live-traffic?mode=snapshot&limit=100&domain=example.test', cache: 'no-store',
        })
        expect(applied).toEqual([{ records: { result: [], total: 0 } }])

        fake.setResponse(response(false, { error: 'unavailable' }))
        await fake.scheduled[1]()
        expect(applied).toEqual([{ records: { result: [], total: 0 } }])
        expect(fake.delays).toEqual([30_000, 30_000, 30_000])
        stop()
    } finally {
        fake.restore()
    }
})

test('shared snapshot requests preserve domain, cache, and failure contracts', async () => {
    const fake = installFakes()
    try {
        fake.setResponse(response(true, { metrics: { total_requests: 1 } }))
        expect(await fetchTrafficSnapshot('example.test')).toEqual({ metrics: { total_requests: 1 } })
        expect(fake.requests).toEqual([{ url: '/api/live-traffic?mode=snapshot&domain=example.test', cache: 'no-store' }])

        fake.setResponse(response(false, { error: 'offline' }))
        await expect(fetchTrafficSnapshot(undefined, undefined, 'Snapshot')).rejects.toThrow('Snapshot returned 503')
    } finally {
        fake.restore()
    }
})

test('stopping during an in-flight snapshot prevents applying it or scheduling another poll', async () => {
    const fake = installFakes()
    const applied: unknown[] = []
    let resolveResponse!: (result: Response) => void
    fake.setResponse(new Promise(resolve => { resolveResponse = resolve }))
    try {
        const stop = startTrafficSnapshotRefresh(undefined, snapshot => applied.push(snapshot))
        const pendingRefresh = fake.scheduled[0]()
        stop()
        resolveResponse(response(true, { metrics: { total_requests: 1 } }))
        await pendingRefresh

        expect(applied).toEqual([])
        expect(fake.delays).toEqual([30_000])
        expect(fake.cleared).toEqual([1])
    } finally {
        fake.restore()
    }
})
