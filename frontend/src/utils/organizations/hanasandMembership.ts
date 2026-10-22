import config from '@/config'
import serverDeviceProofHeaders from '@/utils/auth/serverDeviceProofHeaders'
export async function isHanasandOrganizationMember(token: string, id: string, verifiedSession?: { id: string; token: string }) {
    const response = await fetch(`${config.url.api.replace(/\/$/, '')}/thesis/access`, { cache: 'no-store', headers: { ...await serverDeviceProofHeaders(verifiedSession), Authorization: `Bearer ${token}`, id }, signal: AbortSignal.timeout(10000) })
    if (response.status === 401 || response.status === 403) return false
    if (!response.ok) throw new Error('Organization membership could not be checked.')
    const payload = await response.json() as { member?: unknown }
    if (!payload || typeof payload.member !== 'boolean') throw new Error('Organization membership response was invalid.')
    return payload.member
}
