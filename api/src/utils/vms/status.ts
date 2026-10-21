import config from '#constants'
import { internalHostFetch } from './hostTransport.ts'

type Vm = { name: string; primary_host?: string | null; deleted_at?: string | Date | null; status?: string; last_checked?: string | Date | null }
type State = { status: string; status_reason?: string }
const checks = new Map<string, { expires: number; result: Promise<State> }>()
let localInventory: { expires: number; result: Promise<Map<string, State>> } | undefined

export function invalidateLiveVmStatus(name: string) {
    for (const key of checks.keys()) if (key.endsWith(':' + name)) checks.delete(key)
    localInventory = undefined
}

export async function localVmStatus(name: string): Promise<State> {
    const options: RequestInit & { unix: string } = { unix: config.lxd_socket_path, signal: AbortSignal.timeout(1500) }
    const response = await fetch(`http://localhost/1.0/instances/${encodeURIComponent(name)}/state`, options)
    if (!response.ok) throw new Error(response.status === 404 ? 'VM is unavailable on its host.' : 'VM host is not responding.')
    const body = await response.json() as { metadata?: State }
    if (!body.metadata?.status) throw new Error('VM host did not report a state.')
    return body.metadata
}

async function probe(name: string, host = config.vm_host_id): Promise<State> {
    const targetHost = host.toLowerCase()
    const key = `${targetHost}:${name}`
    const cached = checks.get(key)
    if (cached && cached.expires > Date.now()) return cached.result
    const result = (async () => {
        if (targetHost === String(config.vm_host_id).toLowerCase()) {
            try { return await localVmStatus(name) }
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
            if (!state) return probe(name, targetHost)
            return state
        })
    }))
}

function localVmStatusInventory() {
    if (localInventory && localInventory.expires > Date.now()) return localInventory.result
    const result = (async () => {
        const options: RequestInit & { unix: string } = { unix: config.lxd_socket_path, signal: AbortSignal.timeout(1500) }
        const response = await fetch('http://localhost/1.0/instances?recursion=1', options)
        if (!response.ok) throw new Error('VM host is not responding.')
        const body = await response.json() as { metadata?: Array<{ name?: string; status?: string }> }
        if (!Array.isArray(body.metadata)) throw new Error('VM host did not return its instances.')
        return new Map(body.metadata
            .filter((instance): instance is { name: string; status: string } => Boolean(instance.name && instance.status))
            .map(instance => [instance.name.toLowerCase(), { status: instance.status }]))
    })()
    localInventory = { expires: Date.now() + 5000, result }
    return result
}
