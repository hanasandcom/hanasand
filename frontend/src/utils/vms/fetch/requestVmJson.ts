import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from 'hanasand/cookies'
import { readWorkspace, WORKSPACE_COOKIE } from '@/utils/organizations/workspace'

export async function requestVmJson<T>(path: string, token: string, userId: string, organizationId?: string): Promise<T> {
    const workspaceOrganizationId = organizationId || (typeof document !== 'undefined'
        ? readWorkspace(getCookie(WORKSPACE_COOKIE) || undefined, userId)?.organizationId
        : undefined)
    const response = await fetchWithRetry(`${config.url.api}${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            id: userId,
            ...(workspaceOrganizationId ? { 'x-organization-id': workspaceOrganizationId } : {}),
        },
        timeoutMs: config.abortTimeout,
        retries: 2,
    })

    if (!response.ok) {
        throw new Error(await response.text())
    }

    return await response.json() as T
}
