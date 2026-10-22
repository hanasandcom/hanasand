import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'
import { readWorkspace, WORKSPACE_COOKIE } from '@/utils/organizations/workspace'

export default async function getVM(id: string, token?: string, userId?: string, organizationId?: string | null): Promise<VM[] | null> {
    try {
        const accessToken = token || getCookie('access_token')
        const idHeader = userId || getCookie('id')
        const workspaceOrganizationId = organizationId === undefined
            ? (typeof document !== 'undefined' ? readWorkspace(getCookie(WORKSPACE_COOKIE) || undefined, idHeader || '')?.organizationId : undefined)
            : organizationId || undefined
        const response = await fetchWithRetry(`${config.url.api}/vm/${encodeURIComponent(id)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                id: idHeader || '',
                ...(workspaceOrganizationId ? { 'x-organization-id': workspaceOrganizationId } : {}),
            },
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(`Error fetching vm ${id}.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
