import { setTimeout as delay } from 'node:timers/promises'
import type { SupportedVmSetupService } from './supportedSetupServices.ts'

type HostFetch = (host: string, path: string, options?: RequestInit) => Promise<Response>
type StatusResponse = { status?: unknown; error?: unknown; status_reason?: unknown }
export type VmProvisionOptions = { os?: 'ubuntu-24.04' | 'ubuntu-26.04' | 'ubuntu-22.04' | 'ubuntu-24.04-desktop'; resources?: { cpu: '1' | '2' | '4'; memory: '2GiB' | '4GiB' | '8GiB'; disk: '10GiB' | '20GiB' | '40GiB' }; services?: SupportedVmSetupService[]; aptPackages?: string[]; minecraftEulaAccepted?: boolean; minecraftServerType?: 'PAPER' | 'VANILLA' | 'FABRIC' | 'QUILT' | 'NEOFORGE' | 'PURPUR' | 'FOLIA'; websiteHtml?: string }

const provisionTimeoutMs = 150_000
const statusPollIntervalMs = 2_000
const retryableStatusCodes = new Set([404, 408, 425, 429, 500, 502, 503, 504])

export default async function provisionVmOnHost(host: string, name: string, request: HostFetch, options?: VmProvisionOptions) {
    await enqueueVmProvisionOnHost(host, name, request, options)
    return waitForVmProvisionOnHost(host, name, request)
}

export async function enqueueVmProvisionOnHost(host: string, name: string, request: HostFetch, options?: VmProvisionOptions) {
    const encodedName = encodeURIComponent(name)
    const provision = await request(host, `/vms/internal/${encodedName}/provision`, {
        method: 'POST',
        headers: options ? { 'content-type': 'application/json' } : undefined,
        body: options ? JSON.stringify(options) : undefined,
    })
    if (!provision.ok) throw await hostError(provision, 'VM host provisioning failed')
    if (provision.status !== 202) throw new Error(`VM host returned unexpected queue status ${provision.status}.`)
    await provision.body?.cancel().catch(() => {})
}

export async function waitForVmProvisionOnHost(host: string, name: string, request: HostFetch) {
    const encodedName = encodeURIComponent(name)
    const deadline = Date.now() + provisionTimeoutMs
    while (Date.now() < deadline) {
        let response: Response
        try {
            response = await request(host, `/vms/internal/${encodedName}/status`, { signal: AbortSignal.timeout(5_000) })
        } catch {
            await pollDelay(deadline)
            continue
        }
        if (!response.ok) {
            if (retryableStatusCodes.has(response.status)) {
                await response.body?.cancel().catch(() => {})
                await pollDelay(deadline)
                continue
            }
            throw await hostError(response, 'Unable to verify VM provisioning')
        }
        const body = await response.json() as StatusResponse
        const status = typeof body.status === 'string' ? body.status.toLowerCase() : ''
        if (status === 'running') return
        if (status === 'error') {
            const reason = typeof body.status_reason === 'string' ? body.status_reason : body.error
            throw new Error(typeof reason === 'string' && reason ? reason : `VM provisioning failed on host ${host}.`)
        }
        if (!['provisioning', 'creating', 'starting', 'pending', 'stopped'].includes(status)) {
            throw new Error(`VM provisioning returned unexpected status${status ? ` ${status}` : ''}.`)
        }
        await pollDelay(deadline)
    }
    throw new Error(`VM provisioning did not reach Running on host ${host} within ${provisionTimeoutMs / 1_000} seconds.`)
}

function pollDelay(deadline: number) {
    return delay(Math.min(statusPollIntervalMs, Math.max(0, deadline - Date.now())))
}

async function hostError(response: Response, fallback: string) {
    const body = await response.json().catch(() => ({})) as { error?: unknown }
    return new Error(typeof body.error === 'string' ? body.error : `${fallback} with status ${response.status}.`)
}
