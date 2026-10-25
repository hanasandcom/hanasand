import { createHash } from 'node:crypto'
import config from '#constants'
import { requestLxdJson, type LxdRequestOptions, type LxdResponse } from './lxdTransport.ts'
import { mapLxdDetails, type LxdInstance, type LxdState } from './lxdDetails.ts'
import { waitForInstanceOperations, waitForLxdOperation as waitForOperation } from './lxdOperations.ts'
import { writeVmDetails, type VmDetails } from './vmDetails.ts'
import { vmSetupUserData } from './vmSetupUserData.ts'
import type { VmProvisionOptions } from './provisionOnHost.ts'

const linuxContainersImageServer = 'https://images.linuxcontainers.org'

function imageSource(os: NonNullable<VmProvisionOptions['os']>): { server: string; alias: string } {
    switch (os) {
        case 'ubuntu-22.04': return { server: config.lxd_image_server, alias: '22.04' }
        case 'ubuntu-24.04': return { server: config.lxd_image_server, alias: '24.04' }
        case 'ubuntu-26.04': return { server: config.lxd_image_server, alias: '26.04' }
        case 'ubuntu-24.04-desktop': return { server: linuxContainersImageServer, alias: 'ubuntu/24.04/desktop' }
        case 'debian-13': return { server: linuxContainersImageServer, alias: 'debian/13/cloud' }
        case 'rocky-9': return { server: linuxContainersImageServer, alias: 'rockylinux/9/cloud' }
        case 'centos-stream-10': return { server: linuxContainersImageServer, alias: 'centos/10-Stream/cloud' }
        default: throw new Error('Unsupported VM image.')
    }
}

type LxdRequest = <T>(path: string, options?: LxdRequestOptions) => Promise<LxdResponse<T>>
type VmDetailsWriter = (details: VmDetails) => Promise<unknown>

let lxdRequestImpl: LxdRequest = defaultLxdRequest
let vmDetailsWriter: VmDetailsWriter = writeVmDetails

export function setLxdRequestForTest(request: LxdRequest) {
    lxdRequestImpl = request
    return () => {
        lxdRequestImpl = defaultLxdRequest
    }
}

export function setVmDetailsWriterForTest(writer: VmDetailsWriter) {
    vmDetailsWriter = writer
    return () => {
        vmDetailsWriter = writeVmDetails
    }
}

export async function canUseLocalLxd() {
    try {
        await lxdRequest('/1.0')
        return true
    } catch {
        return false
    }
}

export async function provisionLocalLxdInstance(name: string, options: VmProvisionOptions = {}) {
    const existing = await getLocalLxdInstance(name).catch(() => null)
    const selectedOs = options.os || 'ubuntu-24.04'
    const selectedImage = imageSource(selectedOs)
    const selectedResources = options.resources || { cpu: '1', memory: '2GiB', disk: '10GiB' }
    const selectedServices = [...new Set(options.services || [])].sort()
    const selectedAptPackages = [...new Set(options.aptPackages || [])].sort()
    const optionsForHash = { ...options }
    delete optionsForHash.aptPackages
    const setupHash = createSetupHash({ ...optionsForHash, os: selectedOs, resources: selectedResources, services: selectedServices, ...(selectedAptPackages.length ? { aptPackages: selectedAptPackages } : {}) })
    const hasNonDefaultSetup = selectedOs !== 'ubuntu-24.04'
        || selectedResources.cpu !== '1'
        || selectedResources.memory !== '2GiB'
        || selectedResources.disk !== '10GiB'
        || selectedServices.length > 0
        || selectedAptPackages.length > 0
        || Boolean(options.websiteHtml)
    if (!existing) {
        const rootDiskPool = await localRootDiskPool()
        const response = await lxdRequest<unknown>('/1.0/instances', {
            method: 'POST',
            body: {
                name,
                type: 'container',
                profiles: ['default'],
                devices: { root: { type: 'disk', path: '/', pool: rootDiskPool, size: selectedResources.disk } },
                config: {
                    'limits.cpu': selectedResources.cpu,
                    'limits.memory': selectedResources.memory,
                    ...(selectedServices.includes('docker') ? {
                        'security.nesting': 'true',
                        'security.syscalls.intercept.mknod': 'true',
                        'security.syscalls.intercept.setxattr': 'true',
                    } : {}),
                    'user.hanasand.setup_plan': setupHash,
                    'user.hanasand.provisioning_state': JSON.stringify({ status: 'Provisioning', message: 'Preparing selected services' }),
                    'cloud-init.user-data': vmSetupUserData(name, { ...options, os: selectedOs, resources: selectedResources, services: selectedServices, aptPackages: selectedAptPackages }),
                },
                source: {
                    type: 'image',
                    mode: 'pull',
                    server: selectedImage.server,
                    protocol: 'simplestreams',
                    alias: selectedImage.alias,
                },
            },
        })
        await waitForLxdOperation(response.operation, 120)
    } else if (!existing.config?.['user.hanasand.setup_plan'] && hasNonDefaultSetup) {
        const message = 'This existing VM has no saved setup plan and cannot apply the selected services. Create a new VM to install them.'
        await updateLocalLxdConfig(name, {
            'user.hanasand.setup_plan': setupHash,
            'user.hanasand.provisioning_state': JSON.stringify({ status: 'Error', message }),
        }).catch(() => {})
        throw new Error(message)
    } else if (existing.config?.['user.hanasand.setup_plan'] && existing.config['user.hanasand.setup_plan'] !== setupHash) {
        throw new Error('This VM was created with a different setup plan. Create a new VM to apply the selected operating system, resources, or services.')
    } else if (existing.config?.['user.hanasand.provisioning_state']) {
        const state = parseSetupState(existing.config['user.hanasand.provisioning_state'])
        if (state?.status === 'Error') throw new Error(state.message)
    }

    await setLocalLxdInstanceState(name, 'start', { tolerateAlready: true })
    return refreshLocalLxdDetails(name)
}

async function localRootDiskPool() {
    const profile = await lxdRequest<{ devices?: Record<string, Record<string, string>> }>('/1.0/profiles/default')
    const pool = profile.metadata.devices?.root?.pool?.trim()
    if (!pool) throw new Error('The default LXD profile must define a root storage pool before creating VMs.')
    return pool
}

function createSetupHash(options: VmProvisionOptions) {
    return createHash('sha256').update(JSON.stringify(options)).digest('hex')
}

function parseSetupState(raw: string) {
    try {
        const state = JSON.parse(raw) as { status?: unknown, message?: unknown }
        return typeof state.status === 'string' && typeof state.message === 'string' ? state as { status: string, message: string } : undefined
    } catch {
        return undefined
    }
}

export async function getLocalLxdInstance(name: string) {
    const response = await lxdRequest<LxdInstance>(`/1.0/instances/${encodeURIComponent(name)}`)
    return response.metadata
}

export async function updateLocalLxdConfig(name: string, configValues: Record<string, string>) {
    const response = await lxdRequest<unknown>(`/1.0/instances/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: { config: configValues },
    })
    if (response.operation) await waitForLxdOperation(response.operation, 30)
}

export async function setLocalLxdInstanceState(name: string, action: 'start' | 'stop' | 'restart', options: { tolerateAlready?: boolean } = {}) {
    if (action === 'restart') {
        await setLocalLxdInstanceState(name, 'stop', { tolerateAlready: true })
        return setLocalLxdInstanceState(name, 'start', { tolerateAlready: true })
    }

    const instance = await getLocalLxdInstance(name)
    if (action === 'start' && instance.config?.['user.hanasand.delete_after']) throw new Error('This VM is scheduled for deletion. Restore it before starting.')
    const current = (instance.status || '').toLowerCase()
    if (options.tolerateAlready && ((action === 'start' && current === 'running') || (action === 'stop' && current === 'stopped'))) {
        return refreshLocalLxdDetails(name)
    }

    await waitForInstanceOperations(lxdRequest, name, 120)

    const response = await requestStateTransition(name, action)
    await waitForLxdOperation(response.operation, 90)
    return refreshLocalLxdDetails(name)
}

export async function refreshLocalLxdDetails(name: string, requireState = false) {
    const instance = await getLocalLxdInstance(name)
    const state = await lxdRequest<LxdState>(`/1.0/instances/${encodeURIComponent(name)}/state`).then(response => response.metadata).catch(error => {
        if (requireState) throw error
        return null
    })
    const details = mapLxdDetails(instance, state)
    await vmDetailsWriter(details)
    return details
}

export async function waitForLxdOperation<T = unknown>(operation: string | undefined, timeoutSeconds: number) {
    return waitForOperation<T>(lxdRequest, operation, timeoutSeconds)
}

async function requestStateTransition(name: string, action: 'start' | 'stop') {
    const path = `/1.0/instances/${encodeURIComponent(name)}/state`
    const body = {
        action,
        timeout: 60,
        force: true,
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await lxdRequest<unknown>(path, {
                method: 'PUT',
                body,
            })
        } catch (error) {
            if (!isBusyCreateOperation(error) || attempt === 2) {
                throw error
            }

            await waitForInstanceOperations(lxdRequest, name, 120)
            await sleep(750)
        }
    }

    throw new Error(`Failed to ${action} ${name}.`)
}

function isBusyCreateOperation(error: unknown) {
    return error instanceof Error && /busy running a ["']?(?:create|copy|clone|snapshot|restore)["']? operation/i.test(error.message)
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function lxdRequest<T>(path: string, options: LxdRequestOptions = {}) {
    return lxdRequestImpl<T>(path, options)
}

async function defaultLxdRequest<T>(path: string, options: LxdRequestOptions = {}) {
    const response = await requestLxdJson<T>(config.lxd_socket_path, lxdProjectPath(path, config.lxd_project), options)
    if (response.status_code >= 400 || response.error) {
        throw new Error(response.error || `LXD returned ${response.status_code}`)
    }

    return response
}

export function lxdProjectPath(path: string, project: string) {
    if (!project) return path
    const queryIndex = path.indexOf('?')
    const pathname = queryIndex < 0 ? path : path.slice(0, queryIndex)
    const query = new URLSearchParams(queryIndex < 0 ? '' : path.slice(queryIndex + 1))
    query.set('project', project)
    return `${pathname}?${query.toString()}`
}
