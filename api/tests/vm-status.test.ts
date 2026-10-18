import { afterEach, expect, mock, test } from 'bun:test'

const remoteRequests: Array<{ host: string; path: string }> = []
mock.module('../src/utils/vms/hostTransport.ts', () => ({
    internalHostFetch: async (host: string, path: string) => {
        remoteRequests.push({ host, path })
        return Response.json({ status: 'Running' })
    },
}))

import { invalidateLiveVmStatus, withLiveVmStatus, withLiveVmStatuses } from '../src/utils/vms/status.ts'

const name = 'status-cache-regression-vm'
const originalFetch = globalThis.fetch
let hostStatus = 'Stopped'
let requests = 0

afterEach(() => {
    globalThis.fetch = originalFetch
    invalidateLiveVmStatus(name)
    hostStatus = 'Stopped'
    requests = 0
    remoteRequests.length = 0
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

test('default remote status probe requests the assigned host receiver path', async () => {
    const result = await withLiveVmStatus({ name: 'remote-transport-status-vm', primary_host: 'ovhcloud' })

    expect(result.status).toBe('RUNNING')
    expect(remoteRequests).toEqual([{
        host: 'ovhcloud',
        path: '/vms/internal/remote-transport-status-vm/status',
    }])
})

test('batched VM list status reads local LXD once and keeps remote probes on assigned hosts', async () => {
    let localRequests = 0
    globalThis.fetch = (async () => {
        localRequests++
        return Response.json({ metadata: [
            { name: 'local-inventory-one', status: 'Running' },
            { name: 'local-inventory-two', status: 'Stopped' },
        ] })
    }) as typeof fetch

    const result = await withLiveVmStatuses([
        { name: 'local-inventory-one', primary_host: 'inspur' },
        { name: 'local-inventory-two', primary_host: 'inspur' },
        { name: 'remote-inventory-vm', primary_host: 'ovhcloud' },
    ])

    expect(localRequests).toBe(1)
    expect(result.map(vm => vm.status)).toEqual(['RUNNING', 'STOPPED', 'RUNNING'])
    expect(remoteRequests.at(-1)).toEqual({ host: 'ovhcloud', path: '/vms/internal/remote-inventory-vm/status' })
})
