import { getCookie } from '@/utils/cookies/cookies'
import { vmMinecraftServerTypes, type VmMinecraftServerType } from '../createOptions'

export type VmWebsitePlan = { title: string, tagline: string, sections: Array<{ heading: string, body: string }> }
export type VmSetupPlan = { summary: string, services: string[], website: VmWebsitePlan | null, minecraftServerType: VmMinecraftServerType | null }

export default async function suggestVmSetup(prompt: string): Promise<VmSetupPlan> {
    const token = getCookie('access_token')
    const id = getCookie('id')
    if (!token || !id) throw new Error('Sign in again to ask for a setup suggestion.')
    const response = await fetch('/api/backend/vm/setup-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, id },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(25_000),
    })
    const result = await response.json().catch(() => ({})) as Partial<VmSetupPlan> & { error?: string }
    if (!response.ok || typeof result.summary !== 'string' || !Array.isArray(result.services)) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Unable to suggest a VM setup.')
    }
    return {
        summary: result.summary,
        services: result.services.filter((service): service is string => typeof service === 'string'),
        website: result.website && typeof result.website === 'object' ? result.website as VmWebsitePlan : null,
        minecraftServerType: vmMinecraftServerTypes.some(server => server.id === result.minecraftServerType) ? result.minecraftServerType as VmMinecraftServerType : null,
    }
}
