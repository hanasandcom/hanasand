import config from '#constants'
import { internalHostFetch } from './hostTransport.ts'
import { getLocalLxdInstance, lxdProjectPath, updateLocalLxdConfig } from './lxd.ts'
import { getLocalProvisionState } from './localProvisionState.ts'

type Vm = { name: string; primary_host?: string | null; deleted_at?: string | Date | null; status?: string; last_checked?: string | Date | null }
type State = { status: string; status_reason?: string }
type LocalInstance = { name?: string; status?: string; config?: Record<string, string> }
const checks = new Map<string, { expires: number; result: Promise<State> }>()
let localInventory: { expires: number; result: Promise<Map<string, State>> } | undefined
const provisioningConfigKey = 'user.hanasand.provisioning_state'

export function invalidateLiveVmStatus(name: string) {
    for (const key of checks.keys()) if (key.endsWith(':' + name)) checks.delete(key)
    localInventory = undefined
}

export async function localVmStatus(name: string): Promise<State> {
    const options: RequestInit & { unix: string } = { unix: config.lxd_socket_path, signal: AbortSignal.timeout(1500) }
    const statePath = lxdProjectPath(`/1.0/instances/${encodeURIComponent(name)}/state`, config.lxd_project)
    const response = await fetch(`http://localhost${statePath}`, options)
    if (!response.ok) throw new Error(response.status === 404 ? 'VM is unavailable on its host.' : 'VM host is not responding.')
    const body = await response.json() as { metadata?: State }
    if (!body.metadata?.status) throw new Error('VM host did not report a state.')
    if (body.metadata.status.toLowerCase() !== 'running') return body.metadata

    const instance = await getLocalLxdInstance(name)
    const planHash = instance.config?.['user.hanasand.setup_plan']
    if (!planHash) return body.metadata

    const setupOptions: RequestInit & { unix: string } = { unix: config.lxd_socket_path, signal: AbortSignal.timeout(1500) }
    const setupPath = lxdProjectPath(`/1.0/instances/${encodeURIComponent(name)}/files?path=${encodeURIComponent('/var/lib/hanasand-vm-setup/status')}`, config.lxd_project)
    const setupResponse = await fetch(`http://localhost${setupPath}`, setupOptions).catch(() => null)
    const rawState = setupResponse?.ok ? await setupResponse.text().catch(() => '') : ''
    const [setupStatus, ...messageParts] = rawState.trim().split('\t')
    const setupMessage = messageParts.join('\t').slice(0, 300)
    const persistedState = instance.config?.['user.hanasand.provisioning_state']
    const state = setupStatus === 'Provisioning' || setupStatus === 'Error' || setupStatus === 'Running'
        ? { status: setupStatus, status_reason: setupMessage || undefined }
        : persistedState ? parsePersistedSetupState(persistedState) : undefined
    const setupState = state || { status: 'Provisioning', status_reason: 'Preparing selected services' }

    if (setupState.status !== 'Provisioning' && persistedState !== JSON.stringify(setupState)) {
        await updateLocalLxdConfig(name, { 'user.hanasand.provisioning_state': JSON.stringify(setupState) }).catch(() => {})
    }
    return setupState
}

async function probe(name: string, host = config.vm_host_id): Promise<State> {
    const targetHost = host.toLowerCase()
    const key = `${targetHost}:${name}`
    const cached = checks.get(key)
    if (cached && cached.expires > Date.now()) return cached.result
    const result = (async () => {
        if (targetHost === String(config.vm_host_id).toLowerCase()) {
            if (config.lxd_project) {
                const queued = getLocalProvisionState(name)
                if (queued) return queued
                return localVmStatus(name)
            }
            try {
                const state = await localVmStatus(name)
                // A VM becomes "Running" as soon as the guest has booted, but the host
                // may still be installing the services selected during creation. Read the
                // host worker's queued state so the console can keep showing that progress.
                if (state.status.toLowerCase() === 'running') {
                    try {
                        const response = await internalHostFetch(targetHost, `/vms/internal/${encodeURIComponent(name)}/status`, { signal: AbortSignal.timeout(2000) })
                        if (response.ok) {
                            const provision = await response.json() as State
                            if (['provisioning', 'error'].includes(String(provision.status || '').toLowerCase())) return provision
                        }
                    } catch { /* Keep the live LXD state when the worker status is unavailable. */ }
                }
                return state
            }
            catch {
                // LXD cannot report an instance that is still being allocated. Ask the host
                // worker for its queued state so the inventory can show provisioning instead
                // of incorrectly labelling a newly created VM offline.
                const response = await internalHostFetch(targetHost, `/vms/internal/${encodeURIComponent(name)}/status`, { signal: AbortSignal.timeout(5000) })
                if (!response.ok) throw new Error('VM host is not responding.')
                const body = await response.json() as { status?: string; status_reason?: string }
                if (!body.status) throw new Error('VM host did not report a state.')
                return { status: body.status, status_reason: body.status_reason }
            }
        }
        const response = await internalHostFetch(targetHost, `/vms/internal/${encodeURIComponent(name)}/status`, { signal: AbortSignal.timeout(5000) })
        if (!response.ok) throw new Error('VM host is not responding.')
        const body = await response.json() as { status?: string; status_reason?: string }
        if (!body.status) throw new Error('VM host did not report a state.')
        return { status: body.status, status_reason: body.status_reason }
    })()
    if (checks.size >= 512) checks.delete(checks.keys().next().value!)
    checks.set(key, { expires: Date.now() + 5000, result })
    return result
}

export async function withLiveVmStatus<T extends Vm>(vm: T, check: (name: string, host?: string) => Promise<State> = probe) {
    if (vm.deleted_at) return { ...vm, status: 'PENDING_DELETION', status_reason: 'Scheduled for deletion. Restore the VM to use it again.', status_checked_at: new Date().toISOString() }
    const status_checked_at = new Date().toISOString()
    try {
        const state = await check(vm.name, vm.primary_host || config.vm_host_id)
        return { ...vm, status: state.status.toUpperCase(), status_reason: state.status_reason || (state.status === 'Running' ? '' : `VM is ${state.status.toLowerCase()}.`), status_checked_at }
    } catch {
        return { ...vm, status: 'OFFLINE', status_reason: 'Cannot reach this VM on its host.', status_checked_at }
    }
}

export async function withLiveVmStatuses<T extends Vm>(vms: T[]) {
    const localHost = String(config.vm_host_id).toLowerCase()
    const hasLocalVms = vms.some(vm => !vm.deleted_at && String(vm.primary_host || localHost).toLowerCase() === localHost)
    let states: Map<string, State> | undefined
    if (hasLocalVms) {
        try { states = await localVmStatusInventory() } catch { /* Each local VM receives the same unavailable status below. */ }
    }

    return Promise.all(vms.map(vm => {
        const targetHost = String(vm.primary_host || localHost).toLowerCase()
        if (vm.deleted_at || targetHost !== localHost) return withLiveVmStatus(vm)
        return withLiveVmStatus(vm, async name => {
            const state = states?.get(name.toLowerCase())
            if (state && state.status_reason && state.status.toLowerCase() === 'provisioning') {
                // The persisted LXD marker can outlive the host worker. Ask the worker
                // whether setup is active; it converts an abandoned marker to Error.
                return probe(name, targetHost).catch(() => state)
            }
            if (!state) return probe(name, targetHost)
            return state
        })
    }))
}

function parsePersistedSetupState(raw: string): State | undefined {
    try {
        const value = JSON.parse(raw) as { status?: unknown; message?: unknown }
        if (['Provisioning', 'Error', 'Running'].includes(String(value.status)) && typeof value.message === 'string') {
            return { status: String(value.status), status_reason: value.message.slice(0, 300) }
        }
    } catch { /* Keep the VM's live LXD state if the setup marker is malformed. */ }
    return undefined
}

function localVmStatusInventory() {
    if (localInventory && localInventory.expires > Date.now()) return localInventory.result
    const result = (async () => {
        const options: RequestInit & { unix: string } = { unix: config.lxd_socket_path, signal: AbortSignal.timeout(1500) }
        const inventoryPath = lxdProjectPath('/1.0/instances?recursion=1', config.lxd_project)
        const response = await fetch(`http://localhost${inventoryPath}`, options)
        if (!response.ok) throw new Error('VM host is not responding.')
        const body = await response.json() as { metadata?: LocalInstance[] }
        if (!Array.isArray(body.metadata)) throw new Error('VM host did not return its instances.')
        return new Map(body.metadata
            .filter((instance): instance is LocalInstance & { name: string; status: string } => Boolean(instance.name && instance.status))
            .map(instance => [instance.name.toLowerCase(), provisioningState(instance) || { status: instance.status }]))
    })()
    localInventory = { expires: Date.now() + 5000, result }
    return result
}

function provisioningState(instance: LocalInstance): State | undefined {
    const raw = instance.config?.[provisioningConfigKey]
    if (!raw) return undefined
    try {
        const value = JSON.parse(raw) as { status?: unknown; message?: unknown }
        if ((value.status !== 'Provisioning' && value.status !== 'Error') || typeof value.message !== 'string') return undefined
        return { status: value.status, status_reason: value.message.slice(0, 300) }
    } catch {
        return undefined
    }
}
