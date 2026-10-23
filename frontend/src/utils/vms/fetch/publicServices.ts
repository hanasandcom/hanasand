import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export type VmPublicService = { id: string, name: string, type: 'minecraft-java' | 'tls' | 'http', port: number, hostname: string | null, hostnameUnavailable?: boolean, createdAt: string }
export type VmPublicServicesResponse = { services: VmPublicService[], canManage: boolean, hostname: string, portAlias: string }

export function requestVmPublicServices(vmName: string): Promise<VmPublicServicesResponse>
export function requestVmPublicServices(vmName: string, method: 'GET'): Promise<VmPublicServicesResponse>
export function requestVmPublicServices(vmName: string, method: 'POST', data: unknown): Promise<VmPublicService>
export function requestVmPublicServices(vmName: string, method: 'DELETE', data: string): Promise<{ ok: true }>
export async function requestVmPublicServices(vmName: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', data?: unknown): Promise<VmPublicServicesResponse | VmPublicService | { ok: true }> {
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
    return result as VmPublicServicesResponse | VmPublicService | { ok: true }
}
