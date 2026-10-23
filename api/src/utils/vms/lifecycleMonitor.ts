import { randomUUID } from 'node:crypto'
import { requestLxdJson, type LxdRequestOptions, type LxdResponse } from './lxdTransport.ts'
import { recordServiceCheckCase } from '../status/serviceCheckCase.ts'

export const VM_LIFECYCLE_MONITOR_JOB_ID = 'api-vm-lifecycle-monitor'
export const VM_LIFECYCLE_MONITOR_CHECK = 'Disposable staging VM lifecycle'
const MONITOR_INTERVAL_MS = 6 * 60 * 60 * 1000
const RESOURCE_LIMITS = { cpu: '1', memory: '2GiB', disk: '10GiB' }
const ISOLATED_STAGING_PROJECT = 'hns-stage'

type LxdRequest = <T>(socketPath: string, path: string, options?: LxdRequestOptions) => Promise<LxdResponse<T>>
type MonitorConfig = { enabled: boolean, target: string | null, socketPath: string | null, project: string | null, imageServer: string | null, imageAlias: string | null }
type Instance = { name?: string, type?: string, status?: string, config?: Record<string, string> }
type LxdProject = { name?: string, config?: Record<string, string> }
type OperationResult = { err?: string, status_code?: number }

let nextRunAt = 0
let activeRun: Promise<unknown> | null = null

export function vmLifecycleMonitorConfig(env: NodeJS.ProcessEnv = process.env): MonitorConfig {
    return {
        enabled: env.VM_LIFECYCLE_MONITOR_ENABLED === 'true',
        target: env.VM_LIFECYCLE_MONITOR_TARGET || null,
        socketPath: env.VM_LIFECYCLE_MONITOR_SOCKET_PATH || null,
        project: env.VM_LIFECYCLE_MONITOR_PROJECT || null,
        imageServer: env.VM_LIFECYCLE_MONITOR_IMAGE_SERVER || null,
        imageAlias: env.VM_LIFECYCLE_MONITOR_IMAGE_ALIAS || null,
    }
}

export async function monitorVmLifecycle(options: {
    settings?: MonitorConfig
    request?: LxdRequest
    record?: typeof recordServiceCheckCase
    now?: () => number
    force?: boolean
} = {}) {
    if (activeRun) return activeRun
    const now = options.now || Date.now
    if (!options.force && now() < nextRunAt) return { status: 'skipped', nextRunAt: new Date(nextRunAt).toISOString() }
    activeRun = runVmLifecycleCheck(options).finally(() => { activeRun = null })
    try {
        const result = await activeRun
        nextRunAt = now() + MONITOR_INTERVAL_MS
        return result
    } catch (error) {
        nextRunAt = now() + MONITOR_INTERVAL_MS
        throw error
    }
}

export async function runVmLifecycleCheck(options: {
    settings?: MonitorConfig
    request?: LxdRequest
    record?: typeof recordServiceCheckCase
    now?: () => number
}) {
    const startedAt = (options.now || Date.now)()
    const checkedAt = new Date(startedAt).toISOString()
    const settings = options.settings || vmLifecycleMonitorConfig()
    const request = options.request || requestLxdJson
    const record = options.record || recordServiceCheckCase

    if (!isSafeTarget(settings)) {
        const message = 'Missing isolated staging LXD configuration. VM lifecycle verification has no data.'
        await record('virtual-machines', VM_LIFECYCLE_MONITOR_CHECK, { status: 'degraded', checkedAt, latencyMs: 0, message })
        return { status: 'no-data', message }
    }

    let lifecycleError: unknown
    let lifecycleFailed = false
    try {
        await exerciseDisposableInstance(settings, request)
    } catch (error) {
        lifecycleFailed = true
        lifecycleError = error
    }
    if (lifecycleFailed) {
        const message = `Disposable staging VM lifecycle failed: ${lifecycleError instanceof Error ? lifecycleError.message : 'LXD request failed.'}`
        try {
            await record('virtual-machines', VM_LIFECYCLE_MONITOR_CHECK, { status: 'down', checkedAt, latencyMs: Math.max(0, (options.now || Date.now)() - startedAt), message })
        } catch (recordError) {
            throw new Error(`${message} Monitoring could not save this result.`, { cause: recordError })
        }
        throw lifecycleError
    }
    const message = 'Disposable staging VM lifecycle passed: create, inspect, update configuration, start, stop, and delete all succeeded.'
    await record('virtual-machines', VM_LIFECYCLE_MONITOR_CHECK, { status: 'up', checkedAt, latencyMs: Math.max(0, (options.now || Date.now)() - startedAt), message })
    return { status: 'up', message }
}

function isSafeTarget(settings: MonitorConfig) {
    return settings.enabled
        && settings.target === 'isolated-staging'
        && settings.project === ISOLATED_STAGING_PROJECT
        && Boolean(settings.socketPath && settings.imageServer && settings.imageAlias)
}

export function vmLifecycleMonitorIsConfigured(env: NodeJS.ProcessEnv = process.env) {
    return isSafeTarget(vmLifecycleMonitorConfig(env))
}

export async function exerciseDisposableInstance(settings: MonitorConfig, request: LxdRequest = requestLxdJson) {
    if (!isSafeTarget(settings) || !settings.socketPath || !settings.imageServer || !settings.imageAlias) {
        throw new Error('Lifecycle probes require an explicitly enabled isolated staging LXD target.')
    }

    const name = `hanasand-vm-monitor-${randomUUID().slice(0, 12)}`
    const marker = `hanasand-vm-lifecycle-${randomUUID()}`
    let createSubmitted = false
    let primaryError: unknown
    try {
        await assertRestrictedStagingProject(settings.socketPath, settings.project, request)
        createSubmitted = true
        const created = await request(settings.socketPath, scopedPath('/1.0/instances', settings.project), {
            method: 'POST',
            body: {
                name,
                type: 'virtual-machine',
                ephemeral: true,
                profiles: ['default'],
                devices: { root: { type: 'disk', path: '/', size: RESOURCE_LIMITS.disk } },
                config: { 'limits.cpu': RESOURCE_LIMITS.cpu, 'limits.memory': RESOURCE_LIMITS.memory },
                source: { type: 'image', mode: 'pull', server: settings.imageServer, protocol: 'simplestreams', alias: settings.imageAlias },
            },
        })
        await finishOperation(request, settings.socketPath, settings.project, created, 'create')

        const inspected = await checkedRequest<Instance>(request, settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}`, settings.project))
        if (inspected.name !== name || inspected.type !== 'virtual-machine') throw new Error('LXD returned an unexpected VM identity or type.')

        const updated = await request(settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}`, settings.project), {
            method: 'PATCH', body: { config: { 'user.hanasand.lifecycle_monitor': marker } },
        })
        await finishOperation(request, settings.socketPath, settings.project, updated, 'configuration update')
        const managed = await checkedRequest<Instance>(request, settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}`, settings.project))
        if (managed.config?.['user.hanasand.lifecycle_monitor'] !== marker) throw new Error('LXD did not retain the lifecycle probe configuration update.')

        const started = await request(settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}/state`, settings.project), {
            method: 'PUT', body: { action: 'start', timeout: 60, force: true },
        })
        await finishOperation(request, settings.socketPath, settings.project, started, 'start')
        const state = await checkedRequest<{ status?: string }>(request, settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}/state`, settings.project))
        if (state.status?.toLowerCase() !== 'running') throw new Error(`VM did not reach Running (reported ${state.status || 'no state'}).`)

        const stopped = await request(settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}/state`, settings.project), {
            method: 'PUT', body: { action: 'stop', timeout: 60, force: true },
        })
        await finishOperation(request, settings.socketPath, settings.project, stopped, 'stop')
        const stoppedInstance = await checkedRequest<Instance>(request, settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}`, settings.project))
        if (stoppedInstance.status?.toLowerCase() !== 'stopped') throw new Error(`VM did not reach Stopped (reported ${stoppedInstance.status || 'no state'}).`)
    } catch (error) {
        primaryError = error
    }

    if (createSubmitted) {
        try {
            const existing = await request(settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}`, settings.project)).catch(() => null)
            if (existing?.status_code === 200) {
                if ((existing.metadata as Instance).status?.toLowerCase() === 'running') {
                    const stopped = await request(settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}/state`, settings.project), {
                        method: 'PUT', body: { action: 'stop', timeout: 60, force: true },
                    })
                    await finishOperation(request, settings.socketPath, settings.project, stopped, 'cleanup stop')
                }
                const deleted = await request(settings.socketPath, scopedPath(`/1.0/instances/${encodeURIComponent(name)}`, settings.project), { method: 'DELETE' })
                await finishOperation(request, settings.socketPath, settings.project, deleted, 'cleanup delete')
            }
            const inventory = await checkedRequest<Array<Instance>>(request, settings.socketPath, scopedPath('/1.0/instances?recursion=1', settings.project))
            if (inventory.some(instance => instance.name === name)) throw new Error('Disposable VM remained after deletion.')
        } catch (cleanupError) {
            const reason = cleanupError instanceof Error ? cleanupError.message : 'LXD cleanup request failed.'
            if (primaryError) throw new Error(`${primaryError instanceof Error ? primaryError.message : 'Lifecycle probe failed.'} Cleanup also failed: ${reason}`, { cause: cleanupError })
            throw new Error(`Lifecycle probe succeeded but cleanup failed: ${reason}`, { cause: cleanupError })
        }
    }
    if (primaryError) throw primaryError
}

async function assertRestrictedStagingProject(socketPath: string, project: string | null, request: LxdRequest) {
    if (project !== ISOLATED_STAGING_PROJECT) throw new Error('Lifecycle probe requires the explicitly allowlisted hns-stage LXD project.')
    const result = await checkedRequest<LxdProject>(request, socketPath, `/1.0/projects/${encodeURIComponent(project)}`)
    const config = result.config || {}
    const instanceLimit = Number(config['limits.instances'])
    const vmLimit = Number(config['limits.virtual-machines'])
    if (result.name !== project
        || config.restricted !== 'true'
        || !config['restricted.networks.access']
        || !Number.isInteger(instanceLimit) || instanceLimit < 1
        || !Number.isInteger(vmLimit) || vmLimit < 1) {
        throw new Error('LXD hns-stage must be restricted, network-limited, and quota-limited before lifecycle probes run.')
    }
}

async function finishOperation(request: LxdRequest, socketPath: string, project: string | null, response: LxdResponse<unknown>, label: string) {
    if (!response.operation) {
        if (response.status_code < 200 || response.status_code >= 300) throw new Error(`LXD ${label} failed with status ${response.status_code}.`)
        return
    }
    const operationPath = response.operation.includes('/1.0/operations/')
        ? response.operation
        : `/1.0/operations/${encodeURIComponent(response.operation)}`
    const completed = await checkedRequest<OperationResult>(request, socketPath, scopedPath(`${operationPath}/wait?timeout=120`, project))
    if (completed.err || (completed.status_code !== undefined && completed.status_code !== 200)) {
        throw new Error(`LXD ${label} failed${completed.err ? `: ${completed.err}` : '.'}`)
    }
}

function scopedPath(path: string, project: string | null) {
    if (project !== ISOLATED_STAGING_PROJECT) throw new Error('Lifecycle probe requires the explicitly allowlisted hns-stage LXD project.')
    const [pathname, query = ''] = path.split('?', 2)
    const params = new URLSearchParams(query)
    params.set('project', project)
    return `${pathname}?${params.toString()}`
}

async function checkedRequest<T>(request: LxdRequest, socketPath: string, path: string, options?: LxdRequestOptions) {
    const response = await request<T>(socketPath, path, options)
    if (response.status_code < 200 || response.status_code >= 300) {
        throw new Error(response.error || `LXD returned status ${response.status_code} for ${path}.`)
    }
    return response.metadata
}
