import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '@/utils/cookies/cookies'
import { readWorkspace, WORKSPACE_COOKIE } from '@/utils/organizations/workspace'

export default async function getVMDetails(id: string, token: string, userId: string, refresh = false, organizationId?: string): Promise<VMDetails | null> {
    try {
        const workspaceOrganizationId = organizationId || (typeof document !== 'undefined'
            ? readWorkspace(getCookie(WORKSPACE_COOKIE) || undefined, userId)?.organizationId
            : undefined)
        const response = await fetchWithRetry(`${config.url.api}/vm/details/${encodeURIComponent(id)}${refresh ? '?refresh=1' : ''}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id: userId,
                ...(workspaceOrganizationId ? { 'x-organization-id': workspaceOrganizationId } : {}),
            },
            cache: 'no-store',
            timeoutMs: refresh ? 15000 : config.abortTimeout,
            retries: refresh ? 0 : 2,
        })

        if (!response.ok) {
            const error = await response.json().catch(() => null)
            throw new Error(error?.error || 'Unable to refresh VM details. Please try again.')
        }

        const data: VMDetails = await response.json()
        return data
    } catch (error) {
        if (refresh) throw error
        console.log(error)
        return null
    }
}
