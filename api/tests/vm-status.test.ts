import { afterEach, expect, test } from 'bun:test'
import { invalidateLiveVmStatus, withLiveVmStatus } from '../src/utils/vms/status.ts'

const name = 'status-cache-regression-vm'
const originalFetch = globalThis.fetch
let hostStatus = 'Stopped'
let requests = 0

afterEach(() => {
    globalThis.fetch = originalFetch
    invalidateLiveVmStatus(name)
    hostStatus = 'Stopped'
    requests = 0
})

test('lifecycle status invalidation makes the next page refresh see the host state', async () => {
    globalThis.fetch = (async () => {
        requests++
        return Response.json({ metadata: { status: hostStatus } })
    }) as typeof fetch

    const vm = { name, status: 'stopped' }
    expect((await withLiveVmStatus(vm)).status).toBe('STOPPED')

    hostStatus = 'Running'
    expect((await withLiveVmStatus(vm)).status).toBe('STOPPED')
    expect(requests).toBe(1)

    invalidateLiveVmStatus(name)
    expect((await withLiveVmStatus(vm)).status).toBe('RUNNING')
    expect(requests).toBe(2)
})

test('live status probes the VM primary host rather than the API host', async () => {
    const probed: Array<{ name: string; host?: string }> = []
    const result = await withLiveVmStatus({ name: 'remote-status-vm', primary_host: 'ovhcloud' }, async (name, host) => {
        probed.push({ name, host })
        return { status: 'Running' }
    })
    expect(result.status).toBe('RUNNING')
    expect(probed).toEqual([{ name: 'remote-status-vm', host: 'ovhcloud' }])
})
