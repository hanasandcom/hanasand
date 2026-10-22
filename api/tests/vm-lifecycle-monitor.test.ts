import { expect, mock, test } from 'bun:test'
import type { LxdRequestOptions, LxdResponse } from '../src/utils/vms/lxdTransport.ts'

mock.module('#constants', () => ({ default: { lxd_socket_path: '/run/lxd-prod/unix.socket' } }))
const fakeDatabaseQuery = async (...args: unknown[]) => {
    void args
    return { rows: [] as Record<string, unknown>[] }
}
mock.module('#db', () => ({
    default: fakeDatabaseQuery,
    withTransaction: async (callback: (query: typeof fakeDatabaseQuery) => unknown) => callback(fakeDatabaseQuery),
}))
mock.module('../src/utils/monitoringIssues.ts', () => ({ recordMonitoringOutcome: async () => {} }))
const { exerciseDisposableInstance, runVmLifecycleCheck, vmLifecycleMonitorIsConfigured } = await import('../src/utils/vms/lifecycleMonitor.ts')

const safeSettings = {
    enabled: true,
    target: 'isolated-staging',
    socketPath: '/run/lxd-staging/unix.socket',
    imageServer: 'https://images.example.test/releases',
    imageAlias: '24.04',
}

test('lifecycle monitor requires explicit isolated staging configuration', () => {
    expect(vmLifecycleMonitorIsConfigured({})).toBe(false)
    expect(vmLifecycleMonitorIsConfigured({
        VM_LIFECYCLE_MONITOR_ENABLED: 'true',
        VM_LIFECYCLE_MONITOR_TARGET: 'production',
        VM_LIFECYCLE_MONITOR_SOCKET_PATH: '/run/lxd-prod/unix.socket',
        VM_LIFECYCLE_MONITOR_IMAGE_SERVER: 'https://images.example.test/releases',
        VM_LIFECYCLE_MONITOR_IMAGE_ALIAS: '24.04',
    })).toBe(false)
    expect(vmLifecycleMonitorIsConfigured({
        VM_LIFECYCLE_MONITOR_ENABLED: 'true',
        VM_LIFECYCLE_MONITOR_TARGET: 'isolated-staging',
        VM_LIFECYCLE_MONITOR_SOCKET_PATH: '/run/lxd-prod/unix.socket',
        VM_LIFECYCLE_MONITOR_IMAGE_SERVER: 'https://images.example.test/releases',
        VM_LIFECYCLE_MONITOR_IMAGE_ALIAS: '24.04',
    })).toBe(false)
    expect(vmLifecycleMonitorIsConfigured({
        VM_LIFECYCLE_MONITOR_ENABLED: 'true',
        VM_LIFECYCLE_MONITOR_TARGET: 'isolated-staging',
        VM_LIFECYCLE_MONITOR_SOCKET_PATH: '/run/lxd-staging/unix.socket',
        VM_LIFECYCLE_MONITOR_IMAGE_SERVER: 'https://images.example.test/releases',
        VM_LIFECYCLE_MONITOR_IMAGE_ALIAS: '24.04',
    })).toBe(true)
})

type Instance = { name?: string, type?: string, status?: string, config?: Record<string, string> }

function fakeLxd(options: { failAt?: string, failCleanup?: boolean } = {}) {
    const calls: { path: string, method: string, action?: string }[] = []
    let instance: Instance | null = null
    let running = false
    let patchSeen = false
    const request = async <T>(socketPath: string, path: string, requestOptions: LxdRequestOptions = {}) => {
        expect(socketPath).toBe(safeSettings.socketPath)
        const method = requestOptions.method || 'GET'
        const action = (requestOptions.body as { action?: string } | undefined)?.action
        calls.push({ path, method, ...(action ? { action } : {}) })
        if (options.failAt === path) throw new Error(`injected failure at ${path}`)
        let response: LxdResponse<unknown>
        if (path === '/1.0/instances' && method === 'POST') {
            const body = requestOptions.body as { name: string, type: string, ephemeral: boolean, config: Record<string, string> }
            instance = { name: body.name, type: body.type, status: 'Stopped', config: { ...body.config } }
            response = { status_code: 202, status: 'Accepted', metadata: {}, operation: '/1.0/operations/create' }
        } else if (path === '/1.0/instances?recursion=1') {
            response = { status_code: 200, status: 'Success', metadata: instance ? [instance] : [] }
        } else if (path.startsWith('/1.0/operations/')) {
            response = { status_code: 200, status: 'Success', metadata: { status_code: 200 } }
        } else if (path.endsWith('/state') && method === 'PUT') {
            running = (requestOptions.body as { action: string }).action === 'start'
            if (instance) instance.status = running ? 'Running' : 'Stopped'
            response = { status_code: 202, status: 'Accepted', metadata: {}, operation: `/1.0/operations/${running ? 'start' : 'stop'}` }
        } else if (path.endsWith('/state')) {
            if (options.failAt === 'running-state' && running) {
                response = { status_code: 200, status: 'Success', metadata: { status: 'Starting' } }
            } else {
                response = { status_code: 200, status: 'Success', metadata: { status: running ? 'Running' : 'Stopped' } }
            }
        } else if (path.includes('/instances/') && method === 'PATCH') {
            patchSeen = true
            const body = requestOptions.body as { config: Record<string, string> }
            if (instance) instance.config = { ...instance.config, ...body.config }
            response = { status_code: 202, status: 'Accepted', metadata: {}, operation: '/1.0/operations/config' }
        } else if (path.includes('/instances/') && method === 'DELETE') {
            if (options.failCleanup) response = { status_code: 500, status: 'Failure', error: 'cleanup denied', metadata: {} }
            else {
                instance = null
                running = false
                response = { status_code: 202, status: 'Accepted', metadata: {}, operation: '/1.0/operations/delete' }
            }
        } else if (path.includes('/instances/') && instance) {
            response = { status_code: 200, status: 'Success', metadata: instance }
        } else {
            response = { status_code: 404, status: 'Failure', error: 'not found', metadata: {} }
        }
        return response as LxdResponse<T>
    }
    return { calls, request, wasPatched: () => patchSeen }
}

test('staging probe exercises the virtual machine lifecycle and removes its disposable VM', async () => {
    const lxd = fakeLxd()
    await exerciseDisposableInstance(safeSettings, lxd.request)

    expect(lxd.calls.find(call => call.path === '/1.0/instances' && call.method === 'POST')).toBeDefined()
    expect(lxd.wasPatched()).toBe(true)
    expect(lxd.calls.some(call => call.path.endsWith('/state') && call.method === 'PUT')).toBe(true)
    expect(lxd.calls.filter(call => call.action).map(call => call.action)).toEqual(['start', 'stop'])
    expect(lxd.calls.some(call => call.method === 'DELETE')).toBe(true)
    expect(lxd.calls.at(-1)).toEqual({ path: '/1.0/instances?recursion=1', method: 'GET' })
})

test('a failed VM state check records failure and stops then deletes the disposable VM', async () => {
    const lxd = fakeLxd({ failAt: 'running-state' })
    const observations: { status: string, message: string }[] = []
    await expect(runVmLifecycleCheck({
        settings: safeSettings,
        request: lxd.request,
        now: () => 1_800_000_000_000,
        record: async (_service, _name, result) => { observations.push(result) },
    })).rejects.toThrow('did not reach Running')

    expect(observations).toHaveLength(1)
    expect(observations[0].status).toBe('down')
    expect(lxd.calls.some(call => call.path.endsWith('/state') && call.method === 'PUT')).toBe(true)
    expect(lxd.calls.filter(call => call.action).map(call => call.action)).toEqual(['start', 'stop'])
    expect(lxd.calls.filter(call => call.method === 'DELETE')).toHaveLength(1)
    expect(lxd.calls.at(-1)?.path).toBe('/1.0/instances?recursion=1')
})

test('cleanup failure is reported alongside the lifecycle failure', async () => {
    const lxd = fakeLxd({ failAt: 'running-state', failCleanup: true })
    await expect(exerciseDisposableInstance(safeSettings, lxd.request)).rejects.toThrow('Cleanup also failed: LXD cleanup delete failed')
    expect(lxd.calls.some(call => call.method === 'DELETE')).toBe(true)
})

test('without an isolated staging target the monitor reports no data and makes no LXD request', async () => {
    const lxd = fakeLxd()
    const observations: { status: string, message: string }[] = []
    const result = await runVmLifecycleCheck({
        settings: { ...safeSettings, enabled: false },
        request: lxd.request,
        now: () => 1_800_000_000_000,
        record: async (_service, _name, observation) => { observations.push(observation) },
    })

    expect(result.status).toBe('no-data')
    expect(observations).toEqual([expect.objectContaining({ status: 'degraded', message: expect.stringContaining('has no data') })])
    expect(lxd.calls).toEqual([])
})

test('production LXD socket is rejected even when probe functions are called directly', async () => {
    const productionSettings = { ...safeSettings, socketPath: '/run/lxd-prod/unix.socket' }
    const lxd = fakeLxd()
    const observations: { status: string, message: string }[] = []

    expect(vmLifecycleMonitorIsConfigured({
        VM_LIFECYCLE_MONITOR_ENABLED: 'true',
        VM_LIFECYCLE_MONITOR_TARGET: 'isolated-staging',
        VM_LIFECYCLE_MONITOR_SOCKET_PATH: productionSettings.socketPath,
        VM_LIFECYCLE_MONITOR_IMAGE_SERVER: safeSettings.imageServer,
        VM_LIFECYCLE_MONITOR_IMAGE_ALIAS: safeSettings.imageAlias,
    })).toBe(false)
    const result = await runVmLifecycleCheck({
        settings: productionSettings,
        request: lxd.request,
        record: async (_service, _name, observation) => { observations.push(observation) },
    })

    expect(result.status).toBe('no-data')
    expect(observations[0].status).toBe('degraded')
    expect(lxd.calls).toEqual([])
    await expect(exerciseDisposableInstance(productionSettings, lxd.request)).rejects.toThrow('explicitly enabled isolated staging')
    expect(lxd.calls).toEqual([])
})
