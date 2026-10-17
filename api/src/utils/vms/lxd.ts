import config from '#constants'
import { requestLxdJson, type LxdRequestOptions, type LxdResponse } from './lxdTransport.ts'
import { mapLxdDetails, type LxdInstance, type LxdState } from './lxdDetails.ts'
import { waitForInstanceOperations, waitForLxdOperation as waitForOperation } from './lxdOperations.ts'
import { writeVmDetails, type VmDetails } from './vmDetails.ts'

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

export async function provisionLocalLxdInstance(name: string) {
    const existing = await getLocalLxdInstance(name).catch(() => null)
    if (!existing) {
        const response = await lxdRequest<unknown>('/1.0/instances', {
            method: 'POST',
            body: {
                name,
                type: 'container',
                profiles: ['default'],
                config: {
                    'limits.cpu': '1',
                    'limits.memory': '1GiB',
                },
                source: {
                    type: 'image',
                    mode: 'pull',
                    server: config.lxd_image_server,
                    protocol: 'simplestreams',
                    alias: config.lxd_image_alias,
                },
            },
        })
        await waitForLxdOperation(response.operation, 120)
    }

    await setLocalLxdInstanceState(name, 'start', { tolerateAlready: true })
    return refreshLocalLxdDetails(name)
}

export async function getLocalLxdInstance(name: string) {
    const response = await lxdRequest<LxdInstance>(`/1.0/instances/${encodeURIComponent(name)}`)
    return response.metadata
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
    const response = await requestLxdJson<T>(config.lxd_socket_path, path, options)
    if (response.status_code >= 400 || response.error) {
        throw new Error(response.error || `LXD returned ${response.status_code}`)
    }

    return response
}
