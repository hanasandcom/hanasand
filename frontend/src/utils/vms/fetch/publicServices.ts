import config from '@/config'
import { getCookie } from 'hanasand/cookies'

export type VmPublicServicesResponse = { hostname: string, portAlias: string, note: string }

export async function requestVmPublicServices(vmName: string) {
    const token = getCookie('access_token')
    const userId = getCookie('id')
    if (!token || !userId) throw new Error('Sign in again to view the VM public address.')
    const response = await fetch(`${config.url.api}/vm/${encodeURIComponent(vmName)}/public-services`, {
        headers: { Authorization: `Bearer ${token}`, id: userId },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Unable to load the VM public address.')
    return result as VmPublicServicesResponse
}
