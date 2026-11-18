import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export type VmPublicService = { id: string, name: string, type: 'minecraft-java' | 'tls' | 'http' | 'tcp' | 'udp', port: number, publicPort?: number | null, hostname: string | null, hostnameUnavailable?: boolean, createdAt: string }
export type VmPublicServicesResponse = { services: VmPublicService[], canManage: boolean, hostname: string, portAlias: string }

export function vmPublicServiceAddress(service: VmPublicService, vmHostname: string) {
    if (service.type === 'tcp' || service.type === 'udp') {
        return Number.isInteger(service.publicPort) && Number(service.publicPort) > 0
            ? `${service.hostname || vmHostname}:${service.publicPort}` : null
    }
    return service.hostname ? `${service.hostname}:443` : null
}

export function createdVmPublicServices(result: VmPublicService | { services: VmPublicService[] }) {
    return 'services' in result ? result.services : [result]
}

export function requestVmPublicServices(vmName: string): Promise<VmPublicServicesResponse>
export function requestVmPublicServices(vmName: string, method: 'GET'): Promise<VmPublicServicesResponse>
export function requestVmPublicServices(vmName: string, method: 'POST', data: unknown): Promise<VmPublicService | { services: VmPublicService[] }>
export function requestVmPublicServices(vmName: string, method: 'DELETE', data: string): Promise<{ ok: true }>
export async function requestVmPublicServices(vmName: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', data?: unknown): Promise<VmPublicServicesResponse | VmPublicService | { services: VmPublicService[] } | { ok: true }> {
    const token = getCookie('access_token')
    const userId = getCookie('id')
    if (!token || !userId) throw new Error('Sign in again to manage public services.')
    const response = await fetch(`${config.url.api}/vm/${encodeURIComponent(vmName)}/public-services${method === 'DELETE' && data ? `/${encodeURIComponent(String(data))}` : ''}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, id: userId, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        body: method === 'POST' ? JSON.stringify(data) : undefined,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Unable to update public services.')
    return result as VmPublicServicesResponse | VmPublicService | { services: VmPublicService[] } | { ok: true }
}
