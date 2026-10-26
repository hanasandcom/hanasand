import { afterEach, expect, mock, test } from 'bun:test'

const remoteRequests: Array<{ host: string; path: string }> = []
let hostWorkerStatus: { status: string; status_reason?: string } = { status: 'Running' }
const hostWorkerStatuses = new Map<string, { status: string; status_reason?: string }>()
let hostWorkerHttpStatus = 200
let localLxdProject = ''
let localConfig: Record<string, string> = {}
const localConfigUpdates: Array<Record<string, string>> = []
mock.module('#constants', () => ({ default: { vm_host_id: 'inspur', lxd_socket_path: '/var/lib/lxd/unix.socket', get lxd_project() { return localLxdProject } } }))
mock.module('#utils/vms/hostTransport.ts', () => ({
    internalHostFetch: async (host: string, path: string) => {
        remoteRequests.push({ host, path })
        if (hostWorkerHttpStatus !== 200) return new Response(null, { status: hostWorkerHttpStatus })
        return Response.json(hostWorkerStatuses.get(path) || hostWorkerStatus)
    },
}))
mock.module('#utils/vms/lxd.ts', () => ({
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
    hostWorkerHttpStatus = 200
    localLxdProject = ''
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

test('a host 404 marks a missing VM as an error instead of leaving it offline', async () => {
    hostWorkerHttpStatus = 404

    const result = await withLiveVmStatus({ name: 'missing-on-host-vm', primary_host: 'ovhcloud' })

    expect(result.status).toBe('ERROR')
    expect(result.status_reason).toBe('VM could not be found on its host. Contact Support if the problem persists.')
})

test('a host 503 remains offline rather than being reported as a missing VM', async () => {
    hostWorkerHttpStatus = 503

    const result = await withLiveVmStatus({ name: 'temporarily-unavailable-host-vm', primary_host: 'ovhcloud' })

    expect(result.status).toBe('OFFLINE')
    expect(result.status_reason).toBe('Cannot reach this VM on its host.')
})

test('a VM missing during local allocation resolves to an error when the host confirms 404', async () => {
    hostWorkerHttpStatus = 404
    globalThis.fetch = (async () => { throw new Error('Local LXD inventory is unavailable.') }) as typeof fetch

    const result = await withLiveVmStatus({ name: 'missing-during-allocation-vm' })

    expect(result.status).toBe('ERROR')
    expect(remoteRequests).toEqual([{
        host: 'inspur',
        path: '/vms/internal/missing-during-allocation-vm/status',
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

test('cloud-init errors override the guest setup script success marker', async () => {
    localConfig = { 'user.hanasand.setup_plan': 'setup-hash' }
    globalThis.fetch = (async (input: string | URL | Request) => {
        const path = new URL(String(input)).searchParams.get('path')
        if (path === '/var/lib/hanasand-vm-setup/status') return new Response('Running\tSetup complete')
        if (path === '/var/lib/cloud/data/result.json') {
            return Response.json({ v1: { errors: ['scripts_user RuntimeError: package installation failed'] } })
        }
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    expect(await localVmStatus('cloud-init-failed-setup-vm')).toEqual({
        status: 'Error',
        status_reason: 'VM setup failed during cloud-init. Contact Support if the problem persists.',
    })
    expect(localConfigUpdates).toEqual([{
        'user.hanasand.provisioning_state': JSON.stringify({
            status: 'Error',
            status_reason: 'VM setup failed during cloud-init. Contact Support if the problem persists.',
        }),
    }])
})

test('a stopped VM with a stale success marker reports the cloud-init setup failure', async () => {
    localConfig = { 'user.hanasand.setup_plan': 'setup-hash' }
    globalThis.fetch = (async (input: string | URL | Request) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/state')) return Response.json({ metadata: { status: 'Stopped' } })
        const path = url.searchParams.get('path')
        if (path === '/var/lib/hanasand-vm-setup/status') return new Response('Running\tSetup complete')
        if (path === '/var/lib/cloud/data/result.json') return Response.json({ v1: { errors: ['runcmd package install failed'] } })
        return Response.json({ metadata: { status: 'Stopped' } })
    }) as typeof fetch

    expect(await localVmStatus('stopped-cloud-init-failed-vm')).toEqual({
        status: 'Error',
        status_reason: 'VM setup failed during cloud-init. Contact Support if the problem persists.',
    })
    expect(localConfigUpdates).toEqual([{
        'user.hanasand.provisioning_state': JSON.stringify({
            status: 'Error',
            status_reason: 'VM setup failed during cloud-init. Contact Support if the problem persists.',
        }),
    }])
})

test('cloud-init result with no errors keeps the guest setup success marker', async () => {
    localConfig = { 'user.hanasand.setup_plan': 'setup-hash' }
    globalThis.fetch = (async (input: string | URL | Request) => {
        const path = new URL(String(input)).searchParams.get('path')
        if (path === '/var/lib/hanasand-vm-setup/status') return new Response('Running\tSetup complete')
        if (path === '/var/lib/cloud/data/result.json') return Response.json({ v1: { errors: [] } })
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    expect(await localVmStatus('cloud-init-successful-setup-vm')).toEqual({ status: 'Running', status_reason: 'Setup complete' })
})

test('completed Java setup uses its guest success marker without probing the host worker', async () => {
    localConfig = { 'user.hanasand.setup_plan': 'setup-hash', 'cloud-init.user-data': '' }
    globalThis.fetch = (async (input: string | URL | Request) => {
        if (String(input).includes('/files?')) return new Response('Running\tJava setup complete')
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    expect(await localVmStatus('java-setup-vm')).toEqual({ status: 'Running', status_reason: 'Java setup complete' })
    expect(remoteRequests).toHaveLength(0)
    expect(localConfigUpdates).toEqual([{ 'user.hanasand.provisioning_state': JSON.stringify({ status: 'Running', status_reason: 'Java setup complete' }) }])
})

test('local VM status reports setup failure when cloud-init finished without writing the service status marker', async () => {
    localConfig = {
        'user.hanasand.setup_plan': 'setup-hash',
        'cloud-init.user-data': '#cloud-config\nruncmd: []',
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

test('local status asks the host worker before marking an empty cloud-init setup as failed', async () => {
    localConfig = {
        'user.hanasand.setup_plan': 'setup-hash',
        'cloud-init.user-data': '',
        'user.hanasand.provisioning_state': JSON.stringify({ status: 'Error', status_reason: 'VM startup finished without reporting whether the selected services were installed. Contact Support if the problem persists.' }),
    }
    globalThis.fetch = (async (input: string | URL | Request) => {
        const path = new URL(String(input)).searchParams.get('path')
        if (path === '/var/lib/hanasand-vm-setup/status') return new Response('Not found', { status: 404 })
        if (path === '/var/lib/cloud/instance/boot-finished') return new Response('')
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    expect(await localVmStatus('host-worker-setup-vm')).toEqual({ status: 'Running' })
    expect(remoteRequests).toEqual([{ host: 'inspur', path: '/vms/internal/host-worker-setup-vm/status' }])
    expect(localConfigUpdates).toEqual([{ 'user.hanasand.provisioning_state': JSON.stringify({ status: 'Running' }) }])
})

test('local LXD project keeps missing cloud-init setup as an error instead of querying the host worker', async () => {
    localLxdProject = 'hanasand-vm-stage'
    localConfig = { 'user.hanasand.setup_plan': 'setup-hash', 'cloud-init.user-data': '' }
    globalThis.fetch = (async (input: string | URL | Request) => {
        const path = new URL(String(input)).searchParams.get('path')
        if (path === '/var/lib/hanasand-vm-setup/status') return new Response('Not found', { status: 404 })
        if (path === '/var/lib/cloud/instance/boot-finished') return new Response('')
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    expect((await localVmStatus('cloud-init-setup-vm')).status).toBe('Error')
    expect(remoteRequests).toHaveLength(0)
})

test('local status stays in provisioning while the host worker cannot confirm an empty cloud-init setup', async () => {
    localConfig = { 'user.hanasand.setup_plan': 'setup-hash', 'cloud-init.user-data': '' }
    hostWorkerHttpStatus = 503
    globalThis.fetch = (async (input: string | URL | Request) => {
        const path = new URL(String(input)).searchParams.get('path')
        if (path === '/var/lib/hanasand-vm-setup/status') return new Response('Not found', { status: 404 })
        if (path === '/var/lib/cloud/instance/boot-finished') return new Response('')
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    expect(await localVmStatus('host-worker-unavailable-vm')).toEqual({
        status: 'Provisioning',
        status_reason: 'Waiting for the VM host to confirm service setup.',
    })
    expect(localConfigUpdates).toHaveLength(0)
})

test('local status keeps a host-worker setup failure authoritative with empty cloud-init user data', async () => {
    localConfig = { 'user.hanasand.setup_plan': 'setup-hash', 'cloud-init.user-data': '' }
    hostWorkerStatus = { status: 'Error', status_reason: 'Java installation failed.' }
    globalThis.fetch = (async (input: string | URL | Request) => {
        const path = new URL(String(input)).searchParams.get('path')
        if (path === '/var/lib/hanasand-vm-setup/status') return new Response('Not found', { status: 404 })
        if (path === '/var/lib/cloud/instance/boot-finished') return new Response('')
        return Response.json({ metadata: { status: 'Running' } })
    }) as typeof fetch

    expect(await localVmStatus('host-worker-failed-setup-vm')).toEqual({ status: 'Error', status_reason: 'Java installation failed.' })
    expect(localConfigUpdates).toEqual([{ 'user.hanasand.provisioning_state': JSON.stringify({ status: 'Error', status_reason: 'Java installation failed.' }) }])
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
