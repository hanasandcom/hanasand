import { afterEach, expect, mock, test } from 'bun:test'

const remoteRequests: Array<{ host: string; path: string }> = []
let hostWorkerStatus: { status: string; status_reason?: string } = { status: 'Running' }
const hostWorkerStatuses = new Map<string, { status: string; status_reason?: string }>()
let localConfig: Record<string, string> = {}
const localConfigUpdates: Array<Record<string, string>> = []
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur', lxd_socket_path: '/var/lib/lxd/unix.socket' } }))
mock.module('../src/utils/vms/hostTransport.ts', () => ({
    internalHostFetch: async (host: string, path: string) => {
        remoteRequests.push({ host, path })
        return Response.json(hostWorkerStatuses.get(path) || hostWorkerStatus)
    },
}))
mock.module('../src/utils/vms/lxd.ts', () => ({
    getLocalLxdInstance: async () => ({ config: localConfig }),
    updateLocalLxdConfig: async (_name: string, config: Record<string, string>) => { localConfigUpdates.push(config) },
}))

import { invalidateLiveVmStatus, localVmStatus, withLiveVmStatus, withLiveVmStatuses } from '../src/utils/vms/status.ts'

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
    hostWorkerStatuses.clear()
    hostWorkerStatus = { status: 'Running' }
    localConfig = {}
    localConfigUpdates.length = 0
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

test('local status keeps reporting service setup while the guest is already running', async () => {
    globalThis.fetch = (async () => Response.json({ metadata: { status: 'Running' } })) as typeof fetch
    hostWorkerStatus = { status: 'Provisioning', status_reason: 'Installing nodejs, postgresql…' }

    const result = await withLiveVmStatus({ name: 'local-provisioning-vm' })

    expect(result.status).toBe('PROVISIONING')
    expect(result.status_reason).toBe('Installing nodejs, postgresql…')
    expect(remoteRequests).toHaveLength(1)
})

test('local VM status reads completed cloud-init setup and persists its terminal state', async () => {
    localConfig = { 'user.hanasand.setup_plan': 'setup-hash' }
    globalThis.fetch = (async (input: string | URL | Request) => {
        if (String(input).includes('/files?')) return new Response('Running\tSetup complete')
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    expect(await localVmStatus('setup-complete-vm')).toEqual({ status: 'Running', status_reason: 'Setup complete' })
    expect(localConfigUpdates).toEqual([{ 'user.hanasand.provisioning_state': JSON.stringify({ status: 'Running', status_reason: 'Setup complete' }) }])
})

test('local VM status reports setup failure when cloud-init finished without writing the service status marker', async () => {
    localConfig = {
        'user.hanasand.setup_plan': 'setup-hash',
        'user.hanasand.provisioning_state': JSON.stringify({ status: 'Provisioning', message: 'Installing nodejs, postgresql…' }),
    }
    globalThis.fetch = (async (input: string | URL | Request) => {
        const path = new URL(String(input)).searchParams.get('path')
        if (path === '/var/lib/hanasand-vm-setup/status') return new Response('Not found', { status: 404 })
        if (path === '/var/lib/cloud/instance/boot-finished') return new Response('')
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    const result = await localVmStatus('setup-marker-missing-vm')

    expect(result.status).toBe('Error')
    expect(result.status_reason).toContain('without reporting whether the selected services were installed')
    expect(localConfigUpdates).toEqual([{
        'user.hanasand.provisioning_state': JSON.stringify({ status: 'Error', status_reason: 'VM startup finished without reporting whether the selected services were installed. Contact Support if the problem persists.' }),
    }])
})

test('local VM status accepts its own persisted status_reason field while cloud-init is still running', async () => {
    const savedState = { status: 'Provisioning', status_reason: 'Installing nodejs, postgresql…' }
    localConfig = {
        'user.hanasand.setup_plan': 'setup-hash',
        'user.hanasand.provisioning_state': JSON.stringify(savedState),
    }
    globalThis.fetch = (async (input: string | URL | Request) => String(input).includes('/state')
        ? Response.json({ metadata: { status: 'Running' } })
        : new Response('Not found', { status: 404 })) as typeof fetch

    expect(await localVmStatus('persisted-status-reason-vm')).toEqual(savedState)
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

test('batched VM inventory keeps persisted provisioning and failure feedback', async () => {
    globalThis.fetch = (async () => Response.json({ metadata: [
        { name: 'local-provisioning-inventory', status: 'Running', config: { 'user.hanasand.provisioning_state': JSON.stringify({ status: 'Provisioning', message: 'Installing nodejs, postgresql…' }) } },
        { name: 'local-failed-inventory', status: 'Running', config: { 'user.hanasand.provisioning_state': JSON.stringify({ status: 'Error', message: 'Service installation failed.' }) } },
        { name: 'local-provisioning-status-reason-inventory', status: 'Running', config: { 'user.hanasand.provisioning_state': JSON.stringify({ status: 'Provisioning', status_reason: 'Installing Bun…' }) } },
        { name: 'local-ready-inventory', status: 'Running', config: {} },
    ] })) as typeof fetch
    hostWorkerStatuses.set('/vms/internal/local-provisioning-inventory/status', { status: 'Provisioning', status_reason: 'Installing nodejs, postgresql…' })
    hostWorkerStatuses.set('/vms/internal/local-failed-inventory/status', { status: 'Error', status_reason: 'Service installation failed.' })
    hostWorkerStatuses.set('/vms/internal/local-provisioning-status-reason-inventory/status', { status: 'Provisioning', status_reason: 'Installing Bun…' })

    const result = await withLiveVmStatuses([
        { name: 'local-provisioning-inventory', primary_host: 'inspur' },
        { name: 'local-failed-inventory', primary_host: 'inspur' },
        { name: 'local-provisioning-status-reason-inventory', primary_host: 'inspur' },
        { name: 'local-ready-inventory', primary_host: 'inspur' },
    ])

    expect(result.map(vm => [vm.status, vm.status_reason])).toEqual([
        ['PROVISIONING', 'Installing nodejs, postgresql…'],
        ['ERROR', 'Service installation failed.'],
        ['PROVISIONING', 'Installing Bun…'],
        ['RUNNING', ''],
    ])
    expect(remoteRequests.map(request => request.path)).toEqual([
        '/vms/internal/local-provisioning-inventory/status',
        '/vms/internal/local-provisioning-status-reason-inventory/status',
    ])
})
